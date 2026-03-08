import { AnimationEngine, ClippyState } from './animations'
import { CLIPPY_FRAMES } from './clippy-data'
// @ts-ignore - PNG import handled by Vite
import spriteMapUrl from '../../assets/sprites/clippy-map.png'

export class ClippyWidget {
  private container: HTMLElement
  private spriteEl: HTMLElement
  private bubbleEl: HTMLElement
  private engine: AnimationEngine

  constructor(container: HTMLElement) {
    this.container = container
    this.spriteEl = this.createSpriteElement()
    this.bubbleEl = this.createBubbleElement()
    container.appendChild(this.bubbleEl)
    container.appendChild(this.spriteEl)

    this.engine = new AnimationEngine(this.spriteEl, () => {
      // After non-idle animation completes, return to idle loop
    })

    // Start idle loop immediately — Clippy is alive!
    this.engine.startIdleLoop()
  }

  private createSpriteElement(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'clippy-sprite'
    el.className = 'clippy-sprite'
    el.style.backgroundImage = `url('${spriteMapUrl}')`
    el.style.backgroundPosition = '0px 0px'
    el.style.cursor = 'pointer'

    // Click toggles chat (no drag on sprite — use bubble area for drag)
    el.addEventListener('click', () => this.toggleChat())

    return el
  }

  private createBubbleElement(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'clippy-bubble'
    el.className = 'clippy-bubble hidden'
    el.innerHTML = `
      <div class="bubble-content"></div>
      <div class="bubble-input-area hidden">
        <input type="text" class="bubble-input" placeholder="Ask Clippy..." />
      </div>
      <div class="bubble-actions"></div>
    `
    return el
  }

  /**
   * Play a named animation (e.g., 'Wave', 'Thinking', 'Congratulate')
   */
  playAnimation(name: string): void {
    if (CLIPPY_FRAMES[name]) {
      this.engine.stopIdleLoop()
      this.engine.play(name)
      // Resume idle after animation completes
      setTimeout(() => this.engine.startIdleLoop(), 5000)
    }
  }

  /**
   * Set Clippy's state — maps to the right animation
   */
  setState(state: ClippyState): void {
    this.engine.stopIdleLoop()
    this.engine.playState(state)

    // Resume idle loop after a delay (unless it's a continuous state)
    if (state !== 'thinking' && state !== 'listening') {
      setTimeout(() => this.engine.startIdleLoop(), 5000)
    }
  }

  /**
   * Show speech bubble with text
   */
  speak(text: string, actions?: { label: string; onClick: () => void }[]): void {
    const content = this.bubbleEl.querySelector('.bubble-content') as HTMLElement
    content.innerHTML = text
    this.bubbleEl.classList.remove('hidden')

    const actionsEl = this.bubbleEl.querySelector('.bubble-actions') as HTMLElement
    actionsEl.innerHTML = ''
    if (actions) {
      actions.forEach(action => {
        const btn = document.createElement('button')
        btn.textContent = action.label
        btn.onclick = action.onClick
        actionsEl.appendChild(btn)
      })
    }
  }

  dismiss(): void {
    this.bubbleEl.classList.add('hidden')
  }

  showChat(): void {
    const inputArea = this.bubbleEl.querySelector('.bubble-input-area') as HTMLElement
    inputArea.classList.remove('hidden')
    this.bubbleEl.classList.remove('hidden')
    const input = this.bubbleEl.querySelector('.bubble-input') as HTMLInputElement
    input.focus()
  }

  hideChat(): void {
    const inputArea = this.bubbleEl.querySelector('.bubble-input-area') as HTMLElement
    inputArea.classList.add('hidden')
  }

  toggleChat(): void {
    const inputArea = this.bubbleEl.querySelector('.bubble-input-area') as HTMLElement
    if (inputArea.classList.contains('hidden')) {
      this.showChat()
    } else {
      this.dismiss()
    }
  }

  getEngine(): AnimationEngine {
    return this.engine
  }
}
