import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Settings } from '../settings'
import fs from 'fs'

describe('Settings', () => {
  const testPath = '/tmp/openclippy-test-settings.json'

  beforeEach(() => {
    if (fs.existsSync(testPath)) fs.unlinkSync(testPath)
  })

  afterEach(() => {
    if (fs.existsSync(testPath)) fs.unlinkSync(testPath)
  })

  it('creates default settings on first run', () => {
    const settings = new Settings(testPath)
    expect(settings.get('setupComplete')).toBe(false)
    expect(settings.get('personality')).toBe('active')
  })

  it('persists settings to disk', () => {
    const settings = new Settings(testPath)
    settings.set('provider', 'anthropic')
    const settings2 = new Settings(testPath)
    expect(settings2.get('provider')).toBe('anthropic')
  })

  it('tracks setup wizard completion', () => {
    const settings = new Settings(testPath)
    expect(settings.isFirstRun()).toBe(true)
    settings.set('setupComplete', true)
    expect(settings.isFirstRun()).toBe(false)
  })

  it('returns all settings', () => {
    const settings = new Settings(testPath)
    const all = settings.getAll()
    expect(all).toHaveProperty('personality', 'active')
    expect(all).toHaveProperty('setupComplete', false)
  })
})
