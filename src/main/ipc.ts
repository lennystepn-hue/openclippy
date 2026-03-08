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

  // Window dragging
  let dragStartPos: { x: number; y: number } | null = null
  ipcMain.on('window:startDrag', () => {
    const pos = clippyWindow.getPosition()
    dragStartPos = { x: pos[0], y: pos[1] }
  })

  ipcMain.on('window:dragMove', (_event, dx: number, dy: number) => {
    const pos = clippyWindow.getPosition()
    clippyWindow.setPosition(pos[0] + dx, pos[1] + dy)
  })

  // Stream messages from OpenClaw back to renderer
  let isHeartbeat = false

  chatClient.on('message', (msg) => {
    // Detect heartbeat responses — don't show "HEARTBEAT_OK" to user
    if (msg.type === 'response') {
      const content = msg.content?.trim()
      if (content === 'HEARTBEAT_OK' || content?.startsWith('HEARTBEAT_OK')) {
        // Agent decided nothing to say — stay quiet
        isHeartbeat = false
        return
      }

      // If this was a heartbeat with actual content, show it as proactive speech
      if (isHeartbeat && content) {
        clippyWindow.webContents.send('clippy:speak', content)
        isHeartbeat = false
        return
      }
    }

    // Track if current message is a heartbeat
    if (msg.type === 'chunk' && !isHeartbeat) {
      // Check if this looks like a heartbeat response starting
      if (msg.content?.includes('HEARTBEAT_OK')) {
        isHeartbeat = true
        return
      }
    }

    switch (msg.type) {
      case 'chunk':
        if (!isHeartbeat) {
          clippyWindow.webContents.send('chat:chunk', msg)
        }
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

  // Settings — get all and update individual
  ipcMain.handle('settings:getAll', () => {
    const all = settings.getAll()
    // Mask API keys for security (only show last 4 chars)
    const masked = { ...all }
    if (masked.apiKey) {
      masked.apiKey = masked.apiKey.length > 4
        ? '•'.repeat(masked.apiKey.length - 4) + masked.apiKey.slice(-4)
        : '••••'
    }
    if (masked.visionApiKey) {
      masked.visionApiKey = masked.visionApiKey.length > 4
        ? '•'.repeat(masked.visionApiKey.length - 4) + masked.visionApiKey.slice(-4)
        : '••••'
    }
    if (masked.ttsApiKey) {
      masked.ttsApiKey = masked.ttsApiKey.length > 4
        ? '•'.repeat(masked.ttsApiKey.length - 4) + masked.ttsApiKey.slice(-4)
        : '••••'
    }
    return masked
  })

  ipcMain.on('settings:update', (_event, updates: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(updates)) {
      // Skip masked API keys (don't overwrite with dots)
      if (typeof value === 'string' && value.startsWith('•')) continue

      settings.set(key as any, value as any)
    }

    // Apply personality change immediately
    if (updates.personality) {
      const m = updates.personality as 'chill' | 'active' | 'chaos'
      personality.setMode(m)
      writeSoulFile(m)
      clippyWindow.webContents.send('clippy:mode-changed', m)
    }

    clippyWindow.webContents.send('settings:saved')
  })

  // Reset setup — re-run wizard
  ipcMain.on('settings:resetSetup', () => {
    settings.set('setupComplete', false)
    clippyWindow.webContents.send('settings:showWizard')
  })
}
