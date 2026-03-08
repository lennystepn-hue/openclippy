export type ClippyState =
  | 'idle' | 'thinking' | 'talking' | 'excited'
  | 'angry' | 'sad' | 'laughing' | 'sleeping'
  | 'waving' | 'listening'

interface AnimationDef {
  frames: { x: number; y: number; width: number; height: number; duration: number }[]
  loop: boolean
  returnsToIdle: boolean
}

export class AnimationStateMachine {
  currentState: ClippyState = 'idle'
  private animationDefs: Map<ClippyState, AnimationDef> = new Map()
  private onStateChange?: (state: ClippyState) => void

  constructor(onStateChange?: (state: ClippyState) => void) {
    this.onStateChange = onStateChange
  }

  transition(newState: ClippyState): void {
    this.currentState = newState
    this.onStateChange?.(newState)
  }

  onAnimationComplete(): void {
    const def = this.animationDefs.get(this.currentState)
    if (!def || def.returnsToIdle) {
      this.transition('idle')
    }
  }

  registerAnimation(state: ClippyState, def: AnimationDef): void {
    this.animationDefs.set(state, def)
  }
}
