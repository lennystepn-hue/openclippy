import { describe, it, expect, vi } from 'vitest'

// Mock electron and fs
vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/test-openclippy') }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn()
  }
}))

describe('OpenClaw Config', () => {
  it('exports required functions', async () => {
    const config = await import('../config')
    expect(config.initializeWorkspace).toBeDefined()
    expect(config.writeSoulFile).toBeDefined()
    expect(config.writeAgentsFile).toBeDefined()
    expect(config.buildAndWriteConfig).toBeDefined()
    expect(config.getOpenClawDataDir).toBeDefined()
  })

  it('getOpenClawDataDir returns path', async () => {
    const config = await import('../config')
    const dir = config.getOpenClawDataDir()
    expect(dir).toContain('openclaw')
  })
})
