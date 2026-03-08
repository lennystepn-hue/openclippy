import { describe, it, expect } from 'vitest'
import { createTTSEngine } from '../tts'

describe('TTS', () => {
  it('creates system TTS engine', () => {
    const engine = createTTSEngine('system')
    expect(engine).toBeDefined()
    expect(engine.name).toBe('system')
  })

  it('creates openai TTS engine', () => {
    const engine = createTTSEngine('openai', 'sk-test')
    expect(engine.name).toBe('openai')
  })

  it('creates elevenlabs TTS engine', () => {
    const engine = createTTSEngine('elevenlabs', 'key-test')
    expect(engine.name).toBe('elevenlabs')
  })

  it('creates null engine when disabled', () => {
    const engine = createTTSEngine('none')
    expect(engine.name).toBe('none')
  })

  it('defaults to null engine for unknown type', () => {
    const engine = createTTSEngine('unknown')
    expect(engine.name).toBe('none')
  })
})
