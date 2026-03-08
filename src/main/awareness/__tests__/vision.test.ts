import { describe, it, expect } from 'vitest'
import { buildVisionPrompt } from '../vision'

describe('Vision', () => {
  it('builds vision prompt with window context', () => {
    const prompt = buildVisionPrompt({
      title: 'main.ts - VSCode',
      appName: 'code',
      category: 'coding'
    }, 'active')
    expect(prompt).toContain('main.ts')
    expect(prompt).toContain('coding')
    expect(prompt).toContain('Clippy')
  })

  it('includes chill personality instructions', () => {
    const prompt = buildVisionPrompt(
      { title: 'test', appName: 'test', category: 'unknown' },
      'chill'
    )
    expect(prompt).toContain('truly helpful')
  })

  it('includes chaos personality instructions', () => {
    const prompt = buildVisionPrompt(
      { title: 'test', appName: 'test', category: 'unknown' },
      'chaos'
    )
    expect(prompt).toContain('Go wild')
    expect(prompt).toContain('Roast')
  })

  it('chaos prompt is more detailed than chill', () => {
    const info = { title: 'test', appName: 'test', category: 'unknown' }
    const chillPrompt = buildVisionPrompt(info, 'chill')
    const chaosPrompt = buildVisionPrompt(info, 'chaos')
    expect(chaosPrompt.length).toBeGreaterThan(chillPrompt.length)
  })
})
