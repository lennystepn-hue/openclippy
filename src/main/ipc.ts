import { ipcMain, BrowserWindow, app } from 'electron'
import path from 'path'
import { ClippyChatClient } from './openclaw/http-client'
import { PersonalityManager } from './personality'
import { Settings } from './settings'

export function setupIPC(
  clippyWindow: BrowserWindow,
  chatClient: ClippyChatClient,
  personality: PersonalityManager,
  settings: Settings
): void {
  ipcMain.on('chat:send', (_event, text: string) => {
    const systemPrompt = personality.getSystemPrompt()

    chatClient.send(text, systemPrompt)
  })

  chatClient.on('message', (msg) => {
    if (msg.type === 'chunk') {
      clippyWindow.webContents.send('chat:chunk', msg)
    } else if (msg.type === 'response') {
      clippyWindow.webContents.send('chat:response', msg)
    }
  })

  chatClient.on('error', (err) => {
    clippyWindow.webContents.send('chat:response', {
      type: 'response',
      content: `Error: ${err.message}`,
      done: true
    })
  })

  ipcMain.on('clippy:mode', (_event, mode: string) => {
    personality.setMode(mode as any)
    settings.set('personality', mode as any)
    clippyWindow.webContents.send('clippy:mode-changed', mode)
  })

  ipcMain.handle('clippy:getMode', () => {
    return personality.currentMode()
  })

  ipcMain.on('clippy:toggleChat', () => {
    clippyWindow.webContents.send('clippy:toggleChat')
  })

  ipcMain.on('clippy:dismiss', () => {
    clippyWindow.webContents.send('clippy:dismiss')
  })

  // Setup wizard completion
  ipcMain.on('setup:complete', (_event, data: Record<string, unknown>) => {
    // Save all settings from wizard
    if (data.provider) settings.set('provider', data.provider as string)
    if (data.apiKey) settings.set('apiKey', data.apiKey as string)
    if (data.personality) {
      settings.set('personality', data.personality as any)
      personality.setMode(data.personality as any)
    }
    if (data.visionProvider) settings.set('visionProvider', data.visionProvider as string)
    if (data.ttsEngine) settings.set('ttsEngine', data.ttsEngine as any)
    if (data.hotkey) settings.set('hotkey', data.hotkey as string)
    if (typeof data.autostart === 'boolean') settings.set('autostart', data.autostart)
    if (typeof data.sttEnabled === 'boolean') settings.set('sttEnabled', data.sttEnabled)

    settings.set('setupComplete', true)

    // Notify renderer that setup is done
    clippyWindow.webContents.send('setup:done')
  })

  // Auth setup handlers
  ipcMain.handle('auth:claudeOAuth', async () => {
    const { startClaudeOAuthFlow, saveTokens } = await import('./openclaw/auth')
    const tokenPath = path.join(app.getPath('userData'), 'claude-tokens.json')
    try {
      const tokens = await startClaudeOAuthFlow()
      saveTokens(tokens, tokenPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('auth:setupApiKey', async (_event, provider: string, apiKey: string) => {
    const { setupApiKey } = await import('./openclaw/auth')
    return setupApiKey(provider, apiKey)
  })

  ipcMain.handle('auth:status', async () => {
    const { checkAuthStatus } = await import('./openclaw/auth')
    return checkAuthStatus()
  })

  // Check if first run
  ipcMain.handle('setup:isFirstRun', () => {
    return settings.isFirstRun()
  })
}
