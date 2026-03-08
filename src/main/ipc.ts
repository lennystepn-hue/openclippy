import { ipcMain, BrowserWindow, app, shell, desktopCapturer } from 'electron'
import { execSync } from 'child_process'
import path from 'path'
import { ClippyChatClient } from './openclaw/http-client'
import { PersonalityManager } from './personality'
import { Settings } from './settings'
import { writeSoulFile } from './openclaw/config'
import { saveConversation, listConversations, loadConversation, deleteConversation } from './chat-history'

export function setupIPC(
  clippyWindow: BrowserWindow,
  chatClient: ClippyChatClient,
  personality: PersonalityManager,
  settings: Settings
): void {
  // Conversation tracking state
  let currentConvoId = new Date().toISOString().replace(/[:.]/g, '-')
  let currentConvoMessages: { role: string; content: string }[] = []

  // Chat — sends to OpenClaw agent (which has full tool access)
  ipcMain.on('chat:send', (_event, text: string) => {
    currentConvoMessages.push({ role: 'user', content: text })
    chatClient.send(text)
  })

  // Screenshot capture
  ipcMain.handle('screenshot:capture', async () => {
    try {
      // Hide Clippy window briefly so it's not in the screenshot
      const wasVisible = clippyWindow.isVisible()
      if (wasVisible) clippyWindow.hide()

      // Small delay to let the window actually disappear
      await new Promise(r => setTimeout(r, 200))

      let dataUrl: string | null = null

      // Try desktopCapturer first (works on X11 and Windows)
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 }
        })
        if (sources.length > 0) {
          const screenshot = sources[0].thumbnail.toPNG()
          if (screenshot.length > 100) { // Sanity check — empty captures return tiny buffers
            dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`
          }
        }
      } catch (captureErr) {
        console.error('desktopCapturer failed:', captureErr)
      }

      // Fallback for Linux: use native screenshot tools
      if (!dataUrl && process.platform === 'linux') {
        try {
          const { execSync } = await import('child_process')
          const tmpPath = path.join(app.getPath('temp'), 'clippy-screenshot.png')
          // Try gnome-screenshot, then scrot, then import (ImageMagick)
          const cmds = [
            `gnome-screenshot -f "${tmpPath}" 2>/dev/null`,
            `scrot "${tmpPath}" 2>/dev/null`,
            `import -window root "${tmpPath}" 2>/dev/null`
          ]
          for (const cmd of cmds) {
            try {
              execSync(cmd, { timeout: 5000 })
              const fs = await import('fs')
              if (fs.existsSync(tmpPath)) {
                const buf = fs.readFileSync(tmpPath)
                if (buf.length > 100) {
                  dataUrl = `data:image/png;base64,${buf.toString('base64')}`
                  fs.unlinkSync(tmpPath)
                  break
                }
              }
            } catch { continue }
          }
        } catch (linuxErr) {
          console.error('Linux screenshot fallback failed:', linuxErr)
        }
      }

      // Restore Clippy window
      if (wasVisible) clippyWindow.show()

      return dataUrl
    } catch (err) {
      console.error('Screenshot capture failed:', err)
      clippyWindow.show() // Make sure window comes back
      return null
    }
  })

  // Chat with image
  ipcMain.on('chat:sendWithImage', (_event, text: string, imageDataUrl: string) => {
    currentConvoMessages.push({ role: 'user', content: text })
    chatClient.sendWithImage(text, imageDataUrl)
  })

  // Dropped file handling
  ipcMain.on('chat:sendDroppedFile', async (_event, filePath: string, isImage: boolean) => {
    const fs = await import('fs')
    if (!fs.existsSync(filePath)) return

    if (isImage) {
      try {
        const buf = fs.readFileSync(filePath)
        const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
        const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
        const fileName = filePath.split(/[/\\]/).pop() || 'image'

        currentConvoMessages.push({ role: 'user', content: `[Dropped image: ${fileName}]` })
        chatClient.sendWithImage(`I dropped this image file: ${fileName}. What do you see?`, dataUrl)
      } catch (err) {
        console.error('Failed to read dropped image:', err)
      }
    } else {
      const text = `Please look at this file: ${filePath}`
      currentConvoMessages.push({ role: 'user', content: text })
      chatClient.send(text)
    }
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
        if (msg.content && !isHeartbeat) {
          currentConvoMessages.push({ role: 'assistant', content: msg.content })
          const title = currentConvoMessages.find(m => m.role === 'user')?.content?.slice(0, 50) || 'Chat'
          saveConversation({
            id: currentConvoId,
            title,
            createdAt: new Date().toISOString(),
            messages: currentConvoMessages
          })
        }
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

  // History
  ipcMain.handle('history:list', () => {
    return listConversations()
  })

  ipcMain.handle('history:load', (_event, id: string) => {
    return loadConversation(id)
  })

  ipcMain.on('history:delete', (_event, id: string) => {
    deleteConversation(id)
  })

  ipcMain.on('history:newChat', () => {
    currentConvoId = new Date().toISOString().replace(/[:.]/g, '-')
    currentConvoMessages = []
    chatClient.clearHistory()
    clippyWindow.webContents.send('chat:cleared')
  })

  // Open external URLs in default browser
  ipcMain.on('shell:openExternal', (_event, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      shell.openExternal(url)
    }
  })

  // OpenClaw check — verify openclaw is installed
  ipcMain.handle('openclaw:check', () => {
    const isWindows = process.platform === 'win32'
    try {
      const bin = execSync(isWindows ? 'where openclaw' : 'which openclaw', {
        encoding: 'utf-8',
        timeout: 3000
      }).trim().split('\n')[0]
      if (!bin) return { installed: false }

      try {
        const version = execSync(`"${bin}" --version`, {
          encoding: 'utf-8',
          timeout: 5000
        }).trim()
        return { installed: true, version }
      } catch {
        return { installed: true, version: 'unknown' }
      }
    } catch {
      return { installed: false, error: 'openclaw not found in PATH' }
    }
  })

  // Reset setup — re-run wizard
  ipcMain.on('settings:resetSetup', () => {
    settings.set('setupComplete', false)
    clippyWindow.webContents.send('settings:showWizard')
  })
}
