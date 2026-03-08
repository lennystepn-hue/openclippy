import { describe, it, expect } from 'vitest'
import { AnimationStateMachine, ClippyState } from '../animations'

describe('AnimationStateMachine', () => {
  it('starts in idle state', () => {
    const sm = new AnimationStateMachine()
    expect(sm.currentState).toBe('idle')
  })

  it('transitions to thinking state', () => {
    const sm = new AnimationStateMachine()
    sm.transition('thinking')
    expect(sm.currentState).toBe('thinking')
  })

  it('returns to idle after animation completes', () => {
    const sm = new AnimationStateMachine()
    sm.transition('waving')
    sm.onAnimationComplete()
    expect(sm.currentState).toBe('idle')
  })

  it('has all required states', () => {
    const sm = new AnimationStateMachine()
    const states: ClippyState[] = [
      'idle', 'thinking', 'talking', 'excited',
      'angry', 'sad', 'laughing', 'sleeping', 'waving'
    ]
    states.forEach(state => {
      sm.transition(state)
      expect(sm.currentState).toBe(state)
    })
  })
})
