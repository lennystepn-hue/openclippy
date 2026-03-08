import { describe, it, expect } from 'vitest'
import { buildOpenClawConfig } from '../config'

describe('OpenClaw Config', () => {
  it('creates valid config with default port', () => {
    const config = buildOpenClawConfig({})
    expect(config.gateway.port).toBe(18789)
  })

  it('sets provider from user settings', () => {
    const config = buildOpenClawConfig({
      provider: 'anthropic',
      apiKey: 'sk-test'
    })
    expect(config.models.providers).toHaveProperty('anthropic')
    expect(config.models.providers.anthropic.apiKey).toBe('sk-test')
  })

  it('uses default personality', () => {
    const config = buildOpenClawConfig({})
    expect(config.personality).toBe('active')
  })

  it('respects custom port', () => {
    const config = buildOpenClawConfig({ gatewayPort: 9999 })
    expect(config.gateway.port).toBe(9999)
  })
})
