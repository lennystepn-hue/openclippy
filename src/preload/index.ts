import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('clippy', {
  sendMessage: (text: string) => ipcRenderer.send('chat:send', text),
  onResponse: (callback: (msg: any) => void) =>
    ipcRenderer.on('chat:response', (_event, msg) => callback(msg)),
  onChunk: (callback: (msg: any) => void) =>
    ipcRenderer.on('chat:chunk', (_event, msg) => callback(msg)),
  onTool: (callback: (msg: any) => void) =>
    ipcRenderer.on('chat:tool', (_event, msg) => callback(msg)),
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
  checkAuthStatus: () => ipcRenderer.invoke('auth:status'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  updateSettings: (updates: Record<string, unknown>) => ipcRenderer.send('settings:update', updates),
  resetSetup: () => ipcRenderer.send('settings:resetSetup'),
  onSettingsOpen: (callback: () => void) =>
    ipcRenderer.on('settings:open', () => callback()),
  onSettingsSaved: (callback: () => void) =>
    ipcRenderer.on('settings:saved', () => callback()),
  onShowWizard: (callback: () => void) =>
    ipcRenderer.on('settings:showWizard', () => callback()),

  // Shell
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),

  // Screenshot
  captureScreen: () => ipcRenderer.invoke('screenshot:capture'),
  sendMessageWithImage: (text: string, imageDataUrl: string) =>
    ipcRenderer.send('chat:sendWithImage', text, imageDataUrl),

  // History
  listHistory: () => ipcRenderer.invoke('history:list'),
  loadHistory: (id: string) => ipcRenderer.invoke('history:load', id),
  deleteHistory: (id: string) => ipcRenderer.send('history:delete', id),
  newChat: () => ipcRenderer.send('history:newChat'),
  onChatCleared: (callback: () => void) =>
    ipcRenderer.on('chat:cleared', () => callback()),

  // Window drag
  startDrag: () => ipcRenderer.send('window:startDrag'),
  dragMove: (dx: number, dy: number) => ipcRenderer.send('window:dragMove', dx, dy)
})
