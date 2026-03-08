import { describe, it, expect } from 'vitest'
import { ClippyState } from '../animations'

describe('Animation types', () => {
  it('ClippyState includes all required states', () => {
    const states: ClippyState[] = [
      'idle', 'thinking', 'talking', 'excited',
      'angry', 'sad', 'laughing', 'sleeping', 'waving', 'listening'
    ]
    // Type check passes if this compiles
    expect(states).toHaveLength(10)
  })
})
