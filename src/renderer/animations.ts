import { CLIPPY_FRAMES, IDLE_ANIMATIONS } from './clippy-data'

export type ClippyState =
  | 'idle' | 'thinking' | 'talking' | 'excited'
  | 'angry' | 'sad' | 'laughing' | 'sleeping'
  | 'waving' | 'listening'

// Map our state names to sprite animation names
const STATE_TO_ANIMATION: Record<ClippyState, string> = {
  idle: 'RestPose',
  thinking: 'Thinking',
  talking: 'Explain',
  excited: 'Congratulate',
  angry: 'GetAttention',
  sad: 'EmptyTrash',
  laughing: 'Congratulate',
  sleeping: 'IdleSnooze',
  waving: 'Wave',
  listening: 'Hearing_1'
}

export class AnimationEngine {
  private spriteEl: HTMLElement
  private timer: any = null
  private queue: string[] = []
  private playing = false
  private idleInterval: any = null
  private onAnimationDone?: () => void

  constructor(spriteEl: HTMLElement, onAnimationDone?: () => void) {
    this.spriteEl = spriteEl
    this.onAnimationDone = onAnimationDone
  }

  /**
   * Play a named animation from the sprite data
   */
  play(animationName: string): void {
    const frames = CLIPPY_FRAMES[animationName]
    if (!frames) return

    if (this.playing) {
      this.queue.push(animationName)
      return
    }

    this.playing = true
    let i = 0

    const next = () => {
      if (i >= frames.length) {
        this.playing = false
        this.onAnimationDone?.()

        // Play next queued animation
        if (this.queue.length > 0) {
          this.play(this.queue.shift()!)
        }
        return
      }

      const frame = frames[i]
      this.spriteEl.style.backgroundPosition = `-${frame.x}px -${frame.y}px`
      i++
      this.timer = setTimeout(next, frame.d)
    }

    next()
  }

  /**
   * Play animation for a ClippyState
   */
  playState(state: ClippyState): void {
    const animName = STATE_TO_ANIMATION[state]
    if (animName) {
      this.play(animName)
    }
  }

  /**
   * Start idle animation loop — plays random idle animations every ~10 seconds
   */
  startIdleLoop(): void {
    this.stopIdleLoop()

    // Play initial idle
    this.playRandomIdle()

    this.idleInterval = setInterval(() => {
      if (!this.playing) {
        this.playRandomIdle()
      }
    }, 10000)
  }

  /**
   * Stop the idle loop
   */
  stopIdleLoop(): void {
    if (this.idleInterval) {
      clearInterval(this.idleInterval)
      this.idleInterval = null
    }
  }

  /**
   * Play a random idle animation
   */
  private playRandomIdle(): void {
    const available = IDLE_ANIMATIONS.length > 0 ? IDLE_ANIMATIONS : ['RestPose']
    const name = available[Math.floor(Math.random() * available.length)]
    if (CLIPPY_FRAMES[name]) {
      this.play(name)
    }
  }

  /**
   * Stop current animation
   */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.playing = false
    this.queue = []
  }

  /**
   * Reset to rest pose
   */
  reset(): void {
    this.stop()
    this.spriteEl.style.backgroundPosition = '0px 0px'
  }

  destroy(): void {
    this.stop()
    this.stopIdleLoop()
  }
}
