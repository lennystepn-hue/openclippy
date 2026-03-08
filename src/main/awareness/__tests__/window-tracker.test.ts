import { describe, it, expect } from 'vitest'
import { parseWindowInfo } from '../window-tracker'

describe('WindowTracker', () => {
  it('parses window title and app name', () => {
    const info = parseWindowInfo('index.ts - OpenClippy - Visual Studio Code', 'code')
    expect(info.appName).toBe('code')
    expect(info.title).toBe('index.ts - OpenClippy - Visual Studio Code')
  })

  it('detects email category', () => {
    const info = parseWindowInfo('Inbox - user@gmail.com - Gmail', 'google-chrome')
    expect(info.category).toBe('email')
  })

  it('detects coding context', () => {
    const info = parseWindowInfo('main.ts - project - Visual Studio Code', 'code')
    expect(info.category).toBe('coding')
  })

  it('detects browsing', () => {
    const info = parseWindowInfo('Stack Overflow - How to fix...', 'firefox')
    expect(info.category).toBe('browsing')
  })

  it('detects terminal', () => {
    const info = parseWindowInfo('root@server: ~/project', 'Konsole')
    expect(info.category).toBe('terminal')
  })

  it('detects chat apps', () => {
    const info = parseWindowInfo('General - Rocket.Chat', 'rocket-chat')
    expect(info.category).toBe('chat')
  })

  it('returns unknown for unrecognized apps', () => {
    const info = parseWindowInfo('Some Random App', 'random')
    expect(info.category).toBe('unknown')
  })
})
