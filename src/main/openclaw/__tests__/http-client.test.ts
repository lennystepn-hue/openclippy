import { describe, it, expect } from 'vitest'
import { ClippyChatClient } from '../http-client'

describe('HTTP Chat Client', () => {
  it('creates client with default port', () => {
    const client = new ClippyChatClient()
    expect(client).toBeDefined()
  })

  it('creates client with custom port and token', () => {
    const client = new ClippyChatClient(9999, 'test-token')
    expect(client).toBeDefined()
  })

  it('can set token after creation', () => {
    const client = new ClippyChatClient()
    client.setToken('new-token')
    expect(client).toBeDefined()
  })

  it('is an EventEmitter', () => {
    const client = new ClippyChatClient()
    expect(typeof client.on).toBe('function')
    expect(typeof client.emit).toBe('function')
  })
})
