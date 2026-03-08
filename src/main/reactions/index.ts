import { BrowserWindow } from 'electron'
import { ReactionEvent } from './events'

interface Reaction {
  state: string
  messages: Record<'chill' | 'active' | 'chaos', string[]>
}

const REACTIONS: Record<string, Reaction> = {
  'build-failed': {
    state: 'angry',
    messages: {
      chill: ['Build failed. Check the logs.'],
      active: ['Oof, that build is toast. Want me to check the error?', 'Something broke. Classic.'],
      chaos: ['HAHAHA build failed. Skill issue.', 'L + ratio + build failed', 'Maybe try turning it off and on again?']
    }
  },
  'tests-passed': {
    state: 'excited',
    messages: {
      chill: ['Tests pass.'],
      active: ['All tests green! Nice work.', 'Ship it!'],
      chaos: ['LETS GOOO ALL GREEN BABY', 'Tests passed. Deploy to prod. Do it. No balls.']
    }
  },
  'git-commit': {
    state: 'talking',
    messages: {
      chill: [],
      active: ['Nice commit. Brave message.', 'Another commit to the pile.'],
      chaos: ['Bold commit. Let history judge.', '"fix stuff" — poetry.', 'You committed that? On purpose?']
    }
  },
  'code-copied': {
    state: 'thinking',
    messages: {
      chill: [],
      active: ['Stack Overflow again?', 'Copying code — a time-honored tradition.'],
      chaos: ['Ctrl+C Ctrl+V — the developer workflow', 'I saw that. I saw where you copied that from.']
    }
  },
  'idle-long': {
    state: 'sleeping',
    messages: {
      chill: [],
      active: ['Still there?', 'Taking a break?'],
      chaos: ['Hello?? Lebst du noch?', "I've been sitting here for 30 minutes. Alone. Thanks."]
    }
  }
}

export function getReaction(
  event: ReactionEvent,
  personality: 'chill' | 'active' | 'chaos'
): { state: string; message: string } | null {
  const reaction = REACTIONS[event.type]
  if (!reaction) return null

  const messages = reaction.messages[personality]
  if (messages.length === 0) return null

  const message = messages[Math.floor(Math.random() * messages.length)]
  return { state: reaction.state, message }
}

export function dispatchReaction(
  clippyWindow: BrowserWindow,
  event: ReactionEvent,
  personality: 'chill' | 'active' | 'chaos'
): void {
  const reaction = getReaction(event, personality)
  if (!reaction) return

  clippyWindow.webContents.send('clippy:state', reaction.state)
  clippyWindow.webContents.send('clippy:speak', reaction.message)
}
