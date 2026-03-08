import { app, BrowserWindow, globalShortcut } from 'electron'
import { createClippyWindow } from './clippy-window'
import { createTray } from './tray'
import { OpenClawGateway } from './openclaw/gateway'
import { ClippyChatClient } from './openclaw/ws-client'
import { setupIPC } from './ipc'
import path from 'path'

let clippyWindow: BrowserWindow | null = null
let gateway: OpenClawGateway | null = null
let chatClient: ClippyChatClient | null = null

app.whenReady().then(async () => {
  // 1. Start OpenClaw Gateway
  gateway = new OpenClawGateway()
  try {
    await gateway.start()
  } catch (err) {
    console.error('Failed to start OpenClaw Gateway:', err)
    // Continue anyway — user can configure later via wizard
  }

  // 2. Connect chat client
  chatClient = new ClippyChatClient(gateway.getPort())
  try {
    await chatClient.connect()
  } catch (err) {
    console.error('Failed to connect chat client:', err)
  }

  // 3. Create Clippy window
  clippyWindow = createClippyWindow()
  clippyWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

  // 4. Setup IPC
  if (chatClient) {
    setupIPC(clippyWindow, chatClient)
  }

  // 5. System tray
  createTray(clippyWindow)

  // 6. Global hotkey: Ctrl+Shift+C to toggle chat
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (clippyWindow?.isVisible()) {
      clippyWindow.webContents.send('clippy:toggleChat')
    } else {
      clippyWindow?.show()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  chatClient?.disconnect()
  gateway?.stop()
})

app.on('window-all-closed', () => {
  // Don't quit — Clippy lives in tray
})
