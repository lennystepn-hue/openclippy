export {}

declare global {
  interface Window {
    clippy: {
      // Chat
      sendMessage: (text: string) => void
      onResponse: (callback: (msg: any) => void) => void
      onChunk: (callback: (msg: any) => void) => void
      onTool: (callback: (msg: any) => void) => void
      onClippyState: (callback: (state: string) => void) => void
      onClippySpeak: (callback: (text: string, actions?: any[]) => void) => void
      onSetupDone: (callback: () => void) => void
      onModeChanged: (callback: (mode: string) => void) => void
      setMode: (mode: string) => void
      getMode: () => Promise<string>
      toggleChat: () => void
      dismiss: () => void
      isFirstRun: () => Promise<boolean>
      completeSetup: (data: Record<string, unknown>) => void
      startClaudeLogin: () => Promise<{ success: boolean; error?: string }>
      setupApiKey: (provider: string, key: string) => Promise<boolean>
      checkAuthStatus: () => Promise<string>

      // Screenshot
      captureScreen: () => Promise<string | null>
      sendMessageWithImage: (text: string, imageDataUrl: string) => void

      // Shell
      openExternal: (url: string) => void

      // Settings
      getSettings: () => Promise<Record<string, any>>
      updateSettings: (updates: Record<string, unknown>) => void
      resetSetup: () => void
      onSettingsOpen: (callback: () => void) => void
      onSettingsSaved: (callback: () => void) => void
      onShowWizard: (callback: () => void) => void

      // History
      listHistory: () => Promise<{ id: string; title: string; createdAt: string }[]>
      loadHistory: (id: string) => Promise<{ id: string; title: string; createdAt: string; messages: { role: string; content: string }[] } | null>
      deleteHistory: (id: string) => void
      newChat: () => void
      onChatCleared: (callback: () => void) => void

      // Drag & drop
      sendDroppedFile: (filePath: string, isImage: boolean) => void

      // Window drag
      startDrag: () => void
      dragMove: (dx: number, dy: number) => void
    }
  }
}
