import { ClippyWidget } from './clippy'

export function initChat(widget: ClippyWidget): void {
  const input = document.querySelector('.bubble-input') as HTMLInputElement

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const text = input.value.trim()
      input.value = ''
      window.clippy.sendMessage(text)

      // Show user message and thinking animation
      widget.speak(`<div class="chat-user">${escapeHtml(text)}</div><div class="chat-thinking">Thinking...</div>`)
      widget.setState('thinking')
    }
  })

  let currentResponse = ''

  // Streaming chunks from AI
  window.clippy.onChunk((msg) => {
    currentResponse += msg.content
    widget.speak(formatResponse(currentResponse))
    widget.playAnimation('Explain')
  })

  // Final response
  window.clippy.onResponse((msg) => {
    if (msg.content) {
      widget.speak(formatResponse(msg.content))
    }
    widget.setState('idle')
    currentResponse = ''
  })

  // Tool execution events
  window.clippy.onTool((msg) => {
    if (msg.type === 'start') {
      const toolLabel = toolDisplayName(msg.toolName)
      widget.speak(
        formatResponse(currentResponse) +
        `<div class="chat-tool">${toolLabel}...</div>`
      )
      widget.playAnimation('GetTechy')
    }
  })

  // External state changes
  window.clippy.onClippyState((state) => {
    widget.setState(state as any)
  })

  // Proactive speech (easter eggs, reactions)
  window.clippy.onClippySpeak((text, actions) => {
    widget.speak(text, actions)
    widget.playAnimation('GetAttention')
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatResponse(text: string): string {
  // Basic markdown-ish formatting for the bubble
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function toolDisplayName(name: string): string {
  const names: Record<string, string> = {
    exec: 'Running command',
    bash: 'Running command',
    read: 'Reading file',
    write: 'Writing file',
    edit: 'Editing file',
    apply_patch: 'Applying patch',
    browser: 'Opening browser',
    web_search: 'Searching web',
    web_fetch: 'Fetching page',
    process: 'Managing process',
    cron: 'Setting up automation',
    image: 'Analyzing image'
  }
  return names[name] || `Using ${name}`
}
