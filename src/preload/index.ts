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
  onSetupDone: (callback: () => void) =>
    ipcRenderer.on('setup:done', () => callback()),
  onModeChanged: (callback: (mode: string) => void) =>
    ipcRenderer.on('clippy:mode-changed', (_event, mode) => callback(mode)),
  setMode: (mode: string) => ipcRenderer.send('clippy:mode', mode),
  getMode: () => ipcRenderer.invoke('clippy:getMode'),
  toggleChat: () => ipcRenderer.send('clippy:toggleChat'),
  dismiss: () => ipcRenderer.send('clippy:dismiss'),
  isFirstRun: () => ipcRenderer.invoke('setup:isFirstRun'),
  completeSetup: (data: any) => ipcRenderer.send('setup:complete', data),
  startClaudeLogin: () => ipcRenderer.invoke('auth:claudeOAuth'),
  setupApiKey: (provider: string, key: string) => ipcRenderer.invoke('auth:setupApiKey', provider, key),
  checkAuthStatus: () => ipcRenderer.invoke('auth:status')
})
