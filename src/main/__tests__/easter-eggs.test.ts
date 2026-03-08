import { describe, it, expect } from 'vitest'
import { checkEasterEgg } from '../easter-eggs'

describe('Easter Eggs', () => {
  it('triggers letter easter egg on email app', () => {
    const egg = checkEasterEgg({ type: 'app-opened', app: 'Gmail' })
    expect(egg?.message).toContain('writing a letter')
  })

  it('triggers friday deploy warning', () => {
    const friday = new Date(2026, 2, 13, 17, 0)
    const egg = checkEasterEgg({ type: 'time-check', time: friday })
    expect(egg?.message).toContain('Friday')
  })

  it('triggers konami code', () => {
    const egg = checkEasterEgg({ type: 'konami-code' })
    expect(egg?.animation).toBe('karl-klammer')
  })

  it('has tabs vs spaces opinion', () => {
    const egg = checkEasterEgg({ type: 'user-message', text: 'tabs or spaces?' })
    expect(egg).toBeDefined()
    expect(egg!.message).toContain('Tabs')
  })

  it('has vim vs emacs opinion', () => {
    const egg = checkEasterEgg({ type: 'user-message', text: 'vim vs emacs' })
    expect(egg!.message).toContain('VS Code')
  })

  it('responds to sentience questions', () => {
    const egg = checkEasterEgg({ type: 'user-message', text: 'are you alive' })
    expect(egg!.message).toContain('paperclip')
  })

  it('returns null for unmatched triggers', () => {
    const egg = checkEasterEgg({ type: 'random', text: 'hello' })
    expect(egg).toBeNull()
  })
})
