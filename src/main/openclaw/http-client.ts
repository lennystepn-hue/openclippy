import { EventEmitter } from 'events'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamMessage {
  type: 'chunk' | 'response' | 'tool-start' | 'tool-result'
  content: string
  done: boolean
  toolName?: string
}

export class ClippyChatClient extends EventEmitter {
  private baseUrl: string
  private token: string
  private agentId: string
  private abortController: AbortController | null = null

  constructor(port = 19789, token = '') {
    super()
    this.baseUrl = `http://127.0.0.1:${port}`
    this.token = token
    this.agentId = 'main'
  }

  setToken(token: string): void {
    this.token = token
  }

  /**
   * Send a message to OpenClaw agent. The agent has full tool access
   * and will autonomously execute tools as needed.
   */
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
          'x-openclaw-agent-id': this.agentId,
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify({
          model: 'openclaw',
          messages,
          stream: true
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        this.emit('message', {
          type: 'response',
          content: `Error: ${response.status} — ${errText}`,
          done: true
        } as StreamMessage)
        return
      }

      if (!response.body) {
        this.emit('message', {
          type: 'response',
          content: 'Error: No response body',
          done: true
        } as StreamMessage)
        return
      }

      // Parse SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            this.emit('message', {
              type: 'response',
              content: fullContent,
              done: true
            } as StreamMessage)
            return
          }

          try {
            const parsed = JSON.parse(data)
            const choice = parsed.choices?.[0]

            if (!choice) continue

            // Check for tool calls (OpenClaw agent executing tools)
            if (choice.delta?.tool_calls) {
              for (const tc of choice.delta.tool_calls) {
                if (tc.function?.name) {
                  this.emit('message', {
                    type: 'tool-start',
                    content: tc.function.name,
                    toolName: tc.function.name,
                    done: false
                  } as StreamMessage)
                }
                if (tc.function?.arguments) {
                  // Tool arguments streaming — usually not needed for UI
                }
              }
            }

            // Regular content delta
            const delta = choice.delta?.content
            if (delta) {
              fullContent += delta
              this.emit('message', {
                type: 'chunk',
                content: delta,
                done: false
              } as StreamMessage)
            }

            // Check for finish reason
            if (choice.finish_reason === 'tool_calls') {
              // Agent is executing tools, more content will follow
              this.emit('message', {
                type: 'tool-result',
                content: 'Executing...',
                done: false
              } as StreamMessage)
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // If we get here without [DONE], still emit final
      if (fullContent) {
        this.emit('message', {
          type: 'response',
          content: fullContent,
          done: true
        } as StreamMessage)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.emit('message', {
          type: 'response',
          content: `Connection error: ${err.message}`,
          done: true
        } as StreamMessage)
      }
    }
  }

  /**
   * Directly invoke a single tool via OpenClaw
   */
  async invokeTool(tool: string, args: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify({
          tool,
          args,
          sessionKey: this.agentId
        })
      })

      if (!response.ok) {
        throw new Error(`Tool invoke failed: ${response.status}`)
      }

      return await response.json()
    } catch (err: any) {
      return { error: err.message }
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
