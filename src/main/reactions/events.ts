export interface ReactionEvent {
  type: 'build-failed' | 'tests-passed' | 'git-commit' | 'code-copied'
    | 'idle-long' | 'app-crash' | 'friday-evening' | 'deploy-friday'
  data?: string
}

interface EventMatcher {
  source: string
  pattern: RegExp
  type: ReactionEvent['type']
}

const MATCHERS: EventMatcher[] = [
  { source: 'terminal-output', pattern: /ERR!|FAIL|Error:|failed|BUILD FAILED/i, type: 'build-failed' },
  { source: 'terminal-output', pattern: /passed|success|BUILD SUCCESS|All tests passed/i, type: 'tests-passed' },
  { source: 'file-changed', pattern: /\.git\/COMMIT_EDITMSG/, type: 'git-commit' },
  { source: 'clipboard', pattern: /function |const |let |var |class |import |def |public /m, type: 'code-copied' },
  { source: 'idle', pattern: /^(\d+)$/, type: 'idle-long' }
]

export function matchEvent(source: string, data: string): ReactionEvent | null {
  for (const matcher of MATCHERS) {
    if (matcher.source === source && matcher.pattern.test(data)) {
      if (source === 'idle') {
        const ms = parseInt(data)
        if (ms < 1800000) return null
      }
      return { type: matcher.type, data }
    }
  }
  return null
}
