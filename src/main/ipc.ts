import { ipcMain, BrowserWindow, app } from 'electron'
import path from 'path'
import { ClippyChatClient } from './openclaw/http-client'
import { PersonalityManager } from './personality'
import { Settings } from './settings'
import { writeSoulFile } from './openclaw/config'

export function setupIPC(
  clippyWindow: BrowserWindow,
  chatClient: ClippyChatClient,
  personality: PersonalityManager,
  settings: Settings
): void {
  // Chat — sends to OpenClaw agent (which has full tool access)
  ipcMain.on('chat:send', (_event, text: string) => {
    chatClient.send(text)
  })

  // Stream messages from OpenClaw back to renderer
  chatClient.on('message', (msg) => {
    switch (msg.type) {
      case 'chunk':
        clippyWindow.webContents.send('chat:chunk', msg)
        break
      case 'response':
        clippyWindow.webContents.send('chat:response', msg)
        break
      case 'tool-start':
        clippyWindow.webContents.send('chat:tool', {
          type: 'start',
          toolName: msg.toolName
        })
        break
      case 'tool-result':
        clippyWindow.webContents.send('chat:tool', {
          type: 'result',
          content: msg.content
        })
        break
    }
  })

  // Personality mode change — also updates SOUL.md for OpenClaw
  ipcMain.on('clippy:mode', (_event, mode: string) => {
    const m = mode as 'chill' | 'active' | 'chaos'
    personality.setMode(m)
    settings.set('personality', m)
    writeSoulFile(m)
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
    if (data.provider) settings.set('provider', data.provider as string)
    if (data.apiKey) settings.set('apiKey', data.apiKey as string)
    if (data.personality) {
      const m = data.personality as 'chill' | 'active' | 'chaos'
      settings.set('personality', m)
      personality.setMode(m)
      writeSoulFile(m)
    }
    if (data.visionProvider) settings.set('visionProvider', data.visionProvider as string)
    if (data.ttsEngine) settings.set('ttsEngine', data.ttsEngine as any)
    if (data.hotkey) settings.set('hotkey', data.hotkey as string)
    if (typeof data.autostart === 'boolean') settings.set('autostart', data.autostart)
    if (typeof data.sttEnabled === 'boolean') settings.set('sttEnabled', data.sttEnabled)

    settings.set('setupComplete', true)
    clippyWindow.webContents.send('setup:done')
  })

  // Auth handlers
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
    const tokenPath = path.join(app.getPath('userData'), 'claude-tokens.json')
    const { getValidToken } = await import('./openclaw/auth')
    const token = await getValidToken(tokenPath)
    return token ? 'authenticated' : 'not-authenticated'
  })

  ipcMain.handle('setup:isFirstRun', () => {
    return settings.isFirstRun()
  })
}
