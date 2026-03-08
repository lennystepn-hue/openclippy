import { EventEmitter } from 'events'

export interface OutgoingMessage {
  type: 'message'
  content: string
  timestamp: number
}

export interface IncomingMessage {
  type: 'response' | 'chunk' | 'error' | 'status'
  content: string
  done: boolean
  metadata?: Record<string, unknown>
}

export function formatOutgoingMessage(text: string): OutgoingMessage {
  return {
    type: 'message',
    content: text,
    timestamp: Date.now()
  }
}

export function parseIncomingMessage(raw: string): IncomingMessage {
  return JSON.parse(raw) as IncomingMessage
}

export class ClippyChatClient extends EventEmitter {
  private ws: WebSocket | null = null
  private url: string

  constructor(port = 18789) {
    super()
    this.url = `ws://127.0.0.1:${port}`
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.addEventListener('open', () => {
        this.emit('connected')
        resolve()
      })

      this.ws.addEventListener('message', (event) => {
        const msg = parseIncomingMessage(String(event.data))
        this.emit('message', msg)
      })

      this.ws.addEventListener('close', () => this.emit('disconnected'))
      this.ws.addEventListener('error', (err) => reject(err))
    })
  }

  send(text: string): void {
    if (!this.ws) throw new Error('Not connected')
    const msg = formatOutgoingMessage(text)
    this.ws.send(JSON.stringify(msg))
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}
