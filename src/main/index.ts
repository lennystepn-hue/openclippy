import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'path'
import { createClippyWindow } from './clippy-window'
import { createTray } from './tray'
import { OpenClawGateway } from './openclaw/gateway'
import { ClippyChatClient } from './openclaw/http-client'
import { setupIPC } from './ipc'
import { Settings } from './settings'
import { PersonalityManager } from './personality'
import { WindowTracker } from './awareness/window-tracker'
import { checkEasterEgg } from './easter-eggs'
import { matchEvent } from './reactions/events'
import { dispatchReaction } from './reactions'
import { WorkflowDetector } from './workflows/detector'
import { createTTSEngine } from './voice/tts'

let clippyWindow: BrowserWindow | null = null
let gateway: OpenClawGateway | null = null
let chatClient: ClippyChatClient | null = null

app.whenReady().then(async () => {
  // 1. Load settings
  const settings = new Settings(path.join(app.getPath('userData'), 'settings.json'))
  const personality = new PersonalityManager()
  personality.setMode(settings.get('personality'))

  // 2. Start OpenClaw Gateway
  gateway = new OpenClawGateway()
  try {
    await gateway.start()
  } catch (err) {
    console.error('OpenClaw Gateway failed to start:', err)
  }

  // 3. Create HTTP chat client
  chatClient = new ClippyChatClient(gateway?.getPort() ?? 18789)

  // 4. Create Clippy window
  clippyWindow = createClippyWindow()
  if (process.env.ELECTRON_RENDERER_URL) {
    clippyWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    clippyWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 5. Setup IPC
  setupIPC(clippyWindow, chatClient, personality, settings)

  // 6. System tray
  createTray(clippyWindow)

  // 7. Global hotkey
  const hotkey = settings.get('hotkey') || 'CommandOrControl+Shift+C'
  globalShortcut.register(hotkey, () => {
    if (clippyWindow?.isVisible()) {
      clippyWindow.webContents.send('clippy:toggleChat')
    } else {
      clippyWindow?.show()
    }
  })

  // 8. Window tracker (screen awareness)
  const windowTracker = new WindowTracker()
  const workflowDetector = new WorkflowDetector()

  windowTracker.on('window-changed', (info) => {
    // Record for workflow detection
    workflowDetector.recordAppSwitch(info.appName)

    // Check easter eggs
    const egg = checkEasterEgg({ type: 'app-opened', app: info.title })
    if (egg && personality.shouldReactToEvent('app-opened') && clippyWindow) {
      clippyWindow.webContents.send('clippy:speak', egg.message)
      if (egg.animation) {
        clippyWindow.webContents.send('clippy:state', egg.animation)
      }
    }
  })

  windowTracker.start()

  // 9. TTS engine
  const ttsEngine = createTTSEngine(
    settings.get('ttsEngine') ?? 'none',
    settings.get('ttsApiKey') ?? undefined
  )

  // 10. Periodic proactive behavior
  const startProactive = () => {
    setInterval(() => {
      if (!clippyWindow) return

      // Check time-based easter eggs
      const egg = checkEasterEgg({ type: 'time-check', time: new Date() })
      if (egg && personality.shouldReactToEvent('time-check')) {
        clippyWindow.webContents.send('clippy:speak', egg.message)
      }

      // Check workflow patterns
      const patterns = workflowDetector.detectPatterns()
      if (patterns.length > 0 && personality.currentMode() !== 'chill') {
        const p = patterns[0]
        clippyWindow.webContents.send('clippy:speak',
          `I noticed you do ${p.sequence.join(' → ')} every day around ${p.averageTime}. Want me to automate that?`
        )
      }
    }, personality.getProactiveIntervalMs())
  }

  if (!settings.isFirstRun()) {
    startProactive()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  gateway?.stop()
})

app.on('window-all-closed', () => {
  // Don't quit — Clippy lives in tray
})
