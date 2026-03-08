import { EventEmitter } from 'events'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  content: string
  done: boolean
}

export class ClippyChatClient extends EventEmitter {
  private baseUrl: string
  private token: string
  private sessionUser: string
  private abortController: AbortController | null = null

  constructor(port = 18789, token = '') {
    super()
    this.baseUrl = `http://127.0.0.1:${port}`
    this.token = token
    this.sessionUser = 'openclippy'
  }

  setToken(token: string): void {
    this.token = token
  }

  async send(text: string, systemPrompt?: string): Promise<void> {
    const messages: ChatMessage[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: text })

    this.abortController = new AbortController()

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify({
          model: 'openclaw',
          messages,
          stream: true,
          user: this.sessionUser
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        this.emit('error', new Error(`HTTP ${response.status}: ${response.statusText}`))
        return
      }

      if (!response.body) {
        this.emit('error', new Error('No response body'))
        return
      }

      // Parse SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              this.emit('message', { type: 'response', content: fullContent, done: true })
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                this.emit('message', { type: 'chunk', content: delta, done: false })
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      // If we get here without [DONE], still emit final
      if (fullContent) {
        this.emit('message', { type: 'response', content: fullContent, done: true })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.emit('error', err)
      }
    }
  }

  abort(): void {
    this.abortController?.abort()
    this.abortController = null
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openclaw',
          messages: [{ role: 'user', content: 'ping' }],
          stream: false
        })
      })
      return response.ok
    } catch {
      return false
    }
  }
}
