import { describe, it, expect } from 'vitest'
import { matchEvent } from '../events'
import { getReaction } from '../index'

describe('Event Matching', () => {
  it('detects build failure from terminal output', () => {
    const event = matchEvent('terminal-output', 'npm ERR! Test failed. See above for more details.')
    expect(event?.type).toBe('build-failed')
  })

  it('detects build success', () => {
    const event = matchEvent('terminal-output', 'Tests: 42 passed, 42 total')
    expect(event?.type).toBe('tests-passed')
  })

  it('detects git commit', () => {
    const event = matchEvent('file-changed', '.git/COMMIT_EDITMSG')
    expect(event?.type).toBe('git-commit')
  })

  it('detects clipboard code paste', () => {
    const event = matchEvent('clipboard', 'function doSomething() {\n  const x = 1;\n  return x + 2;\n}')
    expect(event?.type).toBe('code-copied')
  })

  it('detects idle timeout', () => {
    const event = matchEvent('idle', '1800000')
    expect(event?.type).toBe('idle-long')
  })

  it('ignores short idle', () => {
    const event = matchEvent('idle', '60000')
    expect(event).toBeNull()
  })

  it('returns null for unmatched events', () => {
    const event = matchEvent('unknown-source', 'random data')
    expect(event).toBeNull()
  })
})

describe('Reactions', () => {
  it('returns reaction for build failure', () => {
    const reaction = getReaction({ type: 'build-failed' }, 'chaos')
    expect(reaction).not.toBeNull()
    expect(reaction!.state).toBe('angry')
  })

  it('returns null for chill mode on minor events', () => {
    const reaction = getReaction({ type: 'git-commit' }, 'chill')
    expect(reaction).toBeNull()
  })

  it('returns reaction for active mode', () => {
    const reaction = getReaction({ type: 'tests-passed' }, 'active')
    expect(reaction).not.toBeNull()
    expect(reaction!.state).toBe('excited')
  })
})
