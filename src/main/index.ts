import { app, BrowserWindow, globalShortcut } from 'electron'
import path from 'path'
import { createClippyWindow } from './clippy-window'
import { createTray } from './tray'
import { OpenClawGateway } from './openclaw/gateway'
import { ClippyChatClient } from './openclaw/http-client'
import { initializeWorkspace, writeSoulFile } from './openclaw/config'
import { setupIPC } from './ipc'
import { Settings } from './settings'
import { PersonalityManager } from './personality'
import { WindowTracker } from './awareness/window-tracker'
import { checkEasterEgg } from './easter-eggs'
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

  // 2. Initialize OpenClaw workspace (SOUL.md, AGENTS.md, config)
  const configPath = initializeWorkspace({
    provider: settings.get('provider') ?? undefined,
    apiKey: settings.get('apiKey') ?? undefined,
    personality: settings.get('personality')
  })

  // 3. Start OpenClaw Gateway with full agent config
  gateway = new OpenClawGateway()
  gateway.setConfigPath(configPath)

  gateway.on('log', (msg: string) => {
    console.log('[OpenClaw]', msg.trim())
  })

  try {
    await gateway.start()
    console.log('OpenClaw Gateway started on port', gateway.getPort())
  } catch (err) {
    console.error('OpenClaw Gateway failed to start:', err)
    // App still works, just without AI backend
  }

  // 4. Create HTTP chat client (talks to OpenClaw agent)
  chatClient = new ClippyChatClient(gateway?.getPort() ?? 18789)

  // 5. Create Clippy window
  clippyWindow = createClippyWindow()
  if (process.env.ELECTRON_RENDERER_URL) {
    clippyWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    clippyWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 6. Setup IPC (bridges renderer ↔ OpenClaw)
  setupIPC(clippyWindow, chatClient, personality, settings)

  // 7. System tray
  createTray(clippyWindow)

  // 8. Global hotkey
  const hotkey = settings.get('hotkey') || 'CommandOrControl+Shift+C'
  globalShortcut.register(hotkey, () => {
    if (clippyWindow?.isVisible()) {
      clippyWindow.webContents.send('clippy:toggleChat')
    } else {
      clippyWindow?.show()
    }
  })

  // 9. Window tracker (screen awareness)
  const windowTracker = new WindowTracker()
  const workflowDetector = new WorkflowDetector()

  windowTracker.on('window-changed', (info) => {
    workflowDetector.recordAppSwitch(info.appName)

    const egg = checkEasterEgg({ type: 'app-opened', app: info.title })
    if (egg && personality.shouldReactToEvent('app-opened') && clippyWindow) {
      clippyWindow.webContents.send('clippy:speak', egg.message)
      if (egg.animation) {
        clippyWindow.webContents.send('clippy:state', egg.animation)
      }
    }
  })

  windowTracker.start()

  // 10. TTS engine
  const ttsEngine = createTTSEngine(
    settings.get('ttsEngine') ?? 'none',
    settings.get('ttsApiKey') ?? undefined
  )

  // 11. Periodic proactive behavior
  const startProactive = () => {
    setInterval(() => {
      if (!clippyWindow) return

      const egg = checkEasterEgg({ type: 'time-check', time: new Date() })
      if (egg && personality.shouldReactToEvent('time-check')) {
        clippyWindow.webContents.send('clippy:speak', egg.message)
      }

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

  // 12. Auto-refresh Claude token
  const tokenPath = path.join(app.getPath('userData'), 'claude-tokens.json')
  const { getValidToken } = await import('./openclaw/auth')

  setInterval(async () => {
    const token = await getValidToken(tokenPath)
    if (token && chatClient) {
      chatClient.setToken(token)
    }
  }, 300000)

  const initialToken = await getValidToken(tokenPath)
  if (initialToken && chatClient) {
    chatClient.setToken(initialToken)
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  gateway?.stop()
})

app.on('window-all-closed', () => {
  // Don't quit — Clippy lives in tray
})
