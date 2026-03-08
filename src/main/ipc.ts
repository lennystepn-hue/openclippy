import { ipcMain, BrowserWindow } from 'electron'
import { ClippyChatClient, IncomingMessage } from './openclaw/ws-client'

export function setupIPC(clippyWindow: BrowserWindow, chatClient: ClippyChatClient): void {
  ipcMain.on('chat:send', (_event, text: string) => {
    chatClient.send(text)
  })

  chatClient.on('message', (msg: IncomingMessage) => {
    if (msg.type === 'chunk') {
      clippyWindow.webContents.send('chat:chunk', msg)
    } else if (msg.type === 'response') {
      clippyWindow.webContents.send('chat:response', msg)
    }
  })

  ipcMain.on('clippy:mode', (_event, mode: string) => {
    clippyWindow.webContents.send('clippy:state', mode === 'chaos' ? 'excited' : 'idle')
  })

  ipcMain.on('clippy:toggleChat', () => {
    clippyWindow.webContents.send('clippy:toggleChat')
  })

  ipcMain.on('clippy:dismiss', () => {
    clippyWindow.webContents.send('clippy:dismiss')
  })
}
