import { describe, it, expect } from 'vitest'
import { formatOutgoingMessage, parseIncomingMessage } from '../ws-client'

describe('WS Client', () => {
  it('formats outgoing message correctly', () => {
    const msg = formatOutgoingMessage('Hello Clippy')
    expect(msg).toHaveProperty('type', 'message')
    expect(msg).toHaveProperty('content', 'Hello Clippy')
    expect(msg).toHaveProperty('timestamp')
    expect(typeof msg.timestamp).toBe('number')
  })

  it('parses incoming text response', () => {
    const raw = JSON.stringify({
      type: 'response',
      content: 'Hey there!',
      done: true
    })
    const parsed = parseIncomingMessage(raw)
    expect(parsed.type).toBe('response')
    expect(parsed.content).toBe('Hey there!')
    expect(parsed.done).toBe(true)
  })

  it('parses streaming chunks', () => {
    const raw = JSON.stringify({
      type: 'chunk',
      content: 'Hey',
      done: false
    })
    const parsed = parseIncomingMessage(raw)
    expect(parsed.type).toBe('chunk')
    expect(parsed.done).toBe(false)
  })
})
