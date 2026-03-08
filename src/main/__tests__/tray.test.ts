import { describe, it, expect, vi } from 'vitest'

// Mock electron before importing the module under test
vi.mock('electron', () => ({
  Tray: vi.fn(),
  Menu: { buildFromTemplate: vi.fn() },
  BrowserWindow: vi.fn(),
  nativeImage: { createFromPath: vi.fn() }
}))

import { getTrayMenuTemplate } from '../tray'

describe('Tray', () => {
  it('has required menu items', () => {
    const template = getTrayMenuTemplate()
    const labels = template.map(item => item.label).filter(Boolean)
    expect(labels).toContain('Show/Hide Clippy')
    expect(labels).toContain('Mode')
    expect(labels).toContain('Settings')
    expect(labels).toContain('Quit')
  })

  it('has personality mode submenu', () => {
    const template = getTrayMenuTemplate()
    const modeItem = template.find(item => item.label === 'Mode')
    expect(modeItem?.submenu).toHaveLength(3)
  })
})
