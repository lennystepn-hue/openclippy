import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('clippy', {
  sendMessage: (text: string) => ipcRenderer.send('chat:send', text),
  onResponse: (callback: (msg: any) => void) =>
    ipcRenderer.on('chat:response', (_event, msg) => callback(msg)),
  onChunk: (callback: (msg: any) => void) =>
    ipcRenderer.on('chat:chunk', (_event, msg) => callback(msg)),
  onClippyState: (callback: (state: string) => void) =>
    ipcRenderer.on('clippy:state', (_event, state) => callback(state)),
  onClippySpeak: (callback: (text: string, actions?: any[]) => void) =>
    ipcRenderer.on('clippy:speak', (_event, text, actions) => callback(text, actions)),
  setMode: (mode: string) => ipcRenderer.send('clippy:mode', mode),
  getMode: () => ipcRenderer.invoke('clippy:getMode'),
  toggleChat: () => ipcRenderer.send('clippy:toggleChat'),
  dismiss: () => ipcRenderer.send('clippy:dismiss')
})
