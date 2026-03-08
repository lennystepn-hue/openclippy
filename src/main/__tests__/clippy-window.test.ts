import { describe, it, expect, vi } from 'vitest'

// Mock electron before importing the module under test
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 }
    }))
  }
}))

import { getClippyWindowConfig } from '../clippy-window'

describe('ClippyWindow', () => {
  it('creates frameless transparent always-on-top config', () => {
    const config = getClippyWindowConfig()
    expect(config.frame).toBe(false)
    expect(config.transparent).toBe(true)
    expect(config.alwaysOnTop).toBe(true)
    expect(config.skipTaskbar).toBe(true)
    expect(config.resizable).toBe(false)
  })

  it('has correct default dimensions', () => {
    const config = getClippyWindowConfig()
    expect(config.width).toBe(400)
    expect(config.height).toBe(600)
  })
})
