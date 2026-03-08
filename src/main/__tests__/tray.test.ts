import { describe, it, expect, vi } from 'vitest'

// Mock electron before importing
vi.mock('electron', () => ({
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn()
  })),
  Menu: { buildFromTemplate: vi.fn() },
  BrowserWindow: vi.fn(),
  nativeImage: { createFromPath: vi.fn() },
  app: { quit: vi.fn() }
}))

vi.mock('../personality', () => ({
  PersonalityManager: vi.fn()
}))

vi.mock('../settings', () => ({
  Settings: vi.fn()
}))

vi.mock('../openclaw/config', () => ({
  writeSoulFile: vi.fn()
}))

describe('Tray', () => {
  it('module exports createTray', async () => {
    const tray = await import('../tray')
    expect(tray.createTray).toBeDefined()
    expect(typeof tray.createTray).toBe('function')
  })
})
