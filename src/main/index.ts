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

/**
 * Build a proactive prompt that makes Clippy feel alive.
 * The agent will check the system, time, etc. and decide what to say.
 */
function buildProactivePrompt(): string {
  const now = new Date()
  const hour = now.getHours()
  const day = now.toLocaleDateString('en-US', { weekday: 'long' })
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return `[HEARTBEAT] It's ${day}, ${time}. You are Clippy, living on the user's desktop.

Check your HEARTBEAT.md and decide: is there something worth saying right now?

You can:
- Comment on the time/day ("It's Friday afternoon... you're still coding?")
- Check the system (run a quick command, check git status, disk space, etc.)
- Share a random observation or joke
- React to something you find on the system
- Reference something from a previous conversation
- Just say hi in a creative way

Rules:
- If nothing interesting: respond with just "HEARTBEAT_OK" and nothing else
- If you have something to say: say it in 1-2 sentences, in character
- Be surprising. Be random. Be Clippy.
- NEVER start with "It looks like" every time — mix it up
- Hour ${hour}: ${hour < 8 ? 'early morning, maybe they are just waking up' : hour < 12 ? 'morning, workday vibes' : hour < 14 ? 'around lunch' : hour < 17 ? 'afternoon, deep work time' : hour < 20 ? 'evening, wrapping up?' : hour < 23 ? 'night owl mode' : 'very late, they should sleep'}`
}
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

  // 4. Create HTTP chat client (talks to OpenClaw agent)
  chatClient = new ClippyChatClient(gateway?.getPort() ?? 19789)

  try {
    await gateway.start()
    console.log('OpenClaw Gateway started on port', gateway.getPort())
    chatClient.setGatewayReady(true)
  } catch (err) {
    console.error('OpenClaw Gateway failed to start:', err)
    // App still works, just without AI backend — client shows friendly error
  }

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
  createTray(clippyWindow, personality, settings)

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

  // 11. Proactive behavior — Easter eggs + workflow detection + OpenClaw heartbeat
  const startProactive = () => {
    // Easter eggs & workflow detection (local, fast)
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

    // OpenClaw heartbeat delivers messages through the gateway.
    // We also do a local "Clippy is alive" check — if heartbeat doesn't
    // trigger, we do our own random proactive messages via the AI.
    if (gateway?.isReady() && chatClient) {
      const heartbeatInterval = personality.currentMode() === 'chaos' ? 300000
        : personality.currentMode() === 'active' ? 900000
        : 3600000

      setInterval(async () => {
        if (!clippyWindow) return

        // Ask OpenClaw to be proactive (the agent reads HEARTBEAT.md)
        const proactivePrompt = buildProactivePrompt()
        chatClient!.send(proactivePrompt)
      }, heartbeatInterval)
    }
  }

  if (!settings.isFirstRun()) {
    // Delay proactive start by 30s to let everything settle
    setTimeout(startProactive, 30000)
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
