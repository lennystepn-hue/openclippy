declare global {
  interface Window {
    clippy: {
      sendMessage: (text: string) => void
      onResponse: (callback: (msg: any) => void) => void
      onChunk: (callback: (msg: any) => void) => void
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
    }
  }
}

import { ClippyWidget } from './clippy'

export function initChat(widget: ClippyWidget): void {
  const input = document.querySelector('.bubble-input') as HTMLInputElement

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const text = input.value.trim()
      input.value = ''
      window.clippy.sendMessage(text)
      widget.setState('thinking')
    }
  })

  let currentResponse = ''
  window.clippy.onChunk((msg) => {
    currentResponse += msg.content
    widget.speak(currentResponse)
    widget.setState('talking')
  })

  window.clippy.onResponse((msg) => {
    widget.speak(msg.content)
    widget.setState('idle')
    currentResponse = ''
  })

  window.clippy.onClippyState((state) => {
    widget.setState(state as any)
  })

  window.clippy.onClippySpeak((text, actions) => {
    widget.speak(text, actions)
  })
}
