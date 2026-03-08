import { describe, it, expect } from 'vitest'
import { PersonalityManager } from '../personality'

describe('PersonalityManager', () => {
  it('defaults to active mode', () => {
    const pm = new PersonalityManager()
    expect(pm.currentMode()).toBe('active')
  })

  it('generates system prompt per mode', () => {
    const pm = new PersonalityManager()
    pm.setMode('chaos')
    const prompt = pm.getSystemPrompt()
    expect(prompt).toContain('autonomous')
    expect(prompt).toContain('roast')
  })

  it('chill has longest proactive interval', () => {
    const pm = new PersonalityManager()
    pm.setMode('chill')
    expect(pm.getProactiveIntervalMs()).toBe(600000)
  })

  it('chaos has shortest proactive interval', () => {
    const pm = new PersonalityManager()
    pm.setMode('chaos')
    expect(pm.getProactiveIntervalMs()).toBe(60000)
  })

  it('chaos reacts to all events', () => {
    const pm = new PersonalityManager()
    pm.setMode('chaos')
    expect(pm.shouldReactToEvent('idle-short')).toBe(true)
    expect(pm.shouldReactToEvent('anything')).toBe(true)
  })

  it('chill only reacts to important events', () => {
    const pm = new PersonalityManager()
    pm.setMode('chill')
    expect(pm.shouldReactToEvent('build-failed')).toBe(true)
    expect(pm.shouldReactToEvent('git-commit')).toBe(false)
  })
})
