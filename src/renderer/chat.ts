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

  // Screenshot button
  const screenshotBtn = document.querySelector('.bubble-screenshot-btn')
  screenshotBtn?.addEventListener('click', async () => {
    if (screenshotBtn) screenshotBtn.textContent = '...'
    const dataUrl = await window.clippy.captureScreen()
    if (!dataUrl) {
      if (screenshotBtn) screenshotBtn.textContent = '\u{1F4F7}'
      return
    }
    const userText = input.value.trim() || 'What do you see on my screen?'
    input.value = ''
    widget.speak(
      `<div class="chat-user">${escapeHtml(userText)}<br><img class="chat-image" src="${dataUrl}" /></div>` +
      `<div class="chat-thinking">Analyzing screenshot...</div>`
    )
    widget.setState('thinking')
    window.clippy.sendMessageWithImage(userText, dataUrl)
    if (screenshotBtn) screenshotBtn.textContent = '\u{1F4F7}'
  })

  // Delegated click handler for copy buttons and links
  document.querySelector('.bubble-content')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    // Copy button on code blocks
    if (target.classList.contains('code-copy-btn')) {
      e.preventDefault()
      e.stopPropagation()
      const targetId = target.getAttribute('data-target')
      if (targetId) {
        const codeEl = document.getElementById(targetId)
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.textContent || '').then(() => {
            target.classList.add('copied')
            target.innerHTML = '&#x2713;'
            setTimeout(() => {
              target.classList.remove('copied')
              target.innerHTML = '&#x2398;'
            }, 2000)
          })
        }
      }
    }

    // Chat images — open in external browser
    if (target.tagName === 'IMG' && target.classList.contains('chat-image')) {
      e.preventDefault()
      e.stopPropagation()
      const src = (target as HTMLImageElement).src
      if (src && src.startsWith('http')) {
        window.clippy.openExternal(src)
      }
    }

    // Clickable links — open in external browser
    if (target.classList.contains('chat-link')) {
      e.preventDefault()
      e.stopPropagation()
      const url = target.getAttribute('href')
      if (url) {
        window.clippy.openExternal(url)
      }
    }
  })

  // History button
  const historyBtn = document.querySelector('.bubble-history-btn')
  const historyPanel = document.querySelector('.bubble-history-panel') as HTMLElement
  const contentEl = document.querySelector('.bubble-content') as HTMLElement

  historyBtn?.addEventListener('click', async () => {
    const isVisible = !historyPanel.classList.contains('hidden')
    if (isVisible) {
      historyPanel.classList.add('hidden')
      contentEl.classList.remove('hidden')
      return
    }

    const conversations = await window.clippy.listHistory()
    if (conversations.length === 0) {
      historyPanel.innerHTML = '<div class="history-empty">No previous chats yet.</div>'
    } else {
      historyPanel.innerHTML = conversations.map(c => {
        const date = new Date(c.createdAt).toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        })
        return `<div class="history-item" data-id="${c.id}">
          <div class="history-title">${escapeHtml(c.title)}</div>
          <div class="history-date">${date}</div>
        </div>`
      }).join('')
    }

    contentEl.classList.add('hidden')
    historyPanel.classList.remove('hidden')
  })

  // Click on history item to load
  historyPanel?.addEventListener('click', async (e) => {
    const item = (e.target as HTMLElement).closest('.history-item') as HTMLElement
    if (!item) return
    const id = item.dataset.id
    if (!id) return

    const convo = await window.clippy.loadHistory(id)
    if (!convo) return

    let html = ''
    for (const msg of convo.messages) {
      if (msg.role === 'user') {
        html += `<div class="chat-user">${escapeHtml(msg.content)}</div>`
      } else {
        html += formatResponse(msg.content)
      }
    }

    historyPanel.classList.add('hidden')
    contentEl.classList.remove('hidden')
    contentEl.innerHTML = html
  })

  // New chat button
  const newChatBtn = document.querySelector('.bubble-newchat-btn')
  newChatBtn?.addEventListener('click', () => {
    window.clippy.newChat()
  })

  // Handle chat cleared
  window.clippy.onChatCleared(() => {
    const content = document.querySelector('.bubble-content') as HTMLElement
    if (content) {
      content.innerHTML = '<span style="color:#888; font-size:12px;">Ask me anything...</span>'
    }
    currentResponse = ''
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

let codeBlockCounter = 0

function formatResponse(text: string): string {
  codeBlockCounter = 0
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      const id = `code-block-${++codeBlockCounter}`
      return `<div class="code-block-wrapper"><pre><code id="${id}">${escapeHtml(code)}</code></pre><button class="code-copy-btn" data-target="${id}" title="Copy">&#x2398;</button></div>`
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="chat-image" src="$2" alt="$1" />')
    .replace(/(?<![="'])(https?:\/\/[^\s<)]+\.(?:png|jpe?g|gif|webp|svg))(?=[)\s<]|$)/gi, '<img class="chat-image" src="$1" />')
    .replace(/(?<![="'])(https?:\/\/[^\s<)]+)/g, '<a class="chat-link" href="$1">$1</a>')
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
