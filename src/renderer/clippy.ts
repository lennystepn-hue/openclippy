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

    // Manual drag + click detection on sprite
    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    let mouseDownTime = 0

    el.addEventListener('mousedown', (e) => {
      isDragging = false
      dragStartX = e.screenX
      dragStartY = e.screenY
      mouseDownTime = Date.now()
      ;(window as any).clippy.startDrag()

      const onMouseMove = (e2: MouseEvent) => {
        const dx = e2.screenX - dragStartX
        const dy = e2.screenY - dragStartY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isDragging = true
          ;(window as any).clippy.dragMove(dx, dy)
          dragStartX = e2.screenX
          dragStartY = e2.screenY
        }
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)

        // If it was a short click (not drag), toggle chat
        if (!isDragging && Date.now() - mouseDownTime < 300) {
          this.toggleChat()
        }
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    return el
  }

  private createBubbleElement(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'clippy-bubble'
    el.className = 'clippy-bubble hidden'
    el.innerHTML = `
      <div class="bubble-header hidden">
        <button class="bubble-history-btn" title="Chat history">&#x1F552;</button>
        <button class="bubble-newchat-btn" title="New chat">&#x2795;</button>
      </div>
      <div class="bubble-content"></div>
      <div class="bubble-history-panel hidden"></div>
      <div class="bubble-input-area hidden">
        <div class="bubble-input-row">
          <input type="text" class="bubble-input" placeholder="Ask Clippy..." />
          <button class="bubble-screenshot-btn" title="Take screenshot">&#x1F4F7;</button>
        </div>
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
    this.chatVisible = false
  }

  private chatVisible = false

  showChat(): void {
    const inputArea = this.bubbleEl.querySelector('.bubble-input-area') as HTMLElement
    const header = this.bubbleEl.querySelector('.bubble-header') as HTMLElement
    inputArea.classList.remove('hidden')
    header.classList.remove('hidden')
    this.bubbleEl.classList.remove('hidden')
    this.chatVisible = true
    const input = this.bubbleEl.querySelector('.bubble-input') as HTMLInputElement
    input.focus()
  }

  hideChat(): void {
    const inputArea = this.bubbleEl.querySelector('.bubble-input-area') as HTMLElement
    const header = this.bubbleEl.querySelector('.bubble-header') as HTMLElement
    inputArea.classList.add('hidden')
    header.classList.add('hidden')
    this.chatVisible = false
  }

  toggleChat(): void {
    if (this.chatVisible) {
      this.dismiss()
    } else {
      // Show bubble with input ready
      const content = this.bubbleEl.querySelector('.bubble-content') as HTMLElement
      if (!content.innerHTML.trim()) {
        content.innerHTML = '<span style="color:#888; font-size:12px;">Ask me anything...</span>'
      }
      this.showChat()
    }
  }

  getEngine(): AnimationEngine {
    return this.engine
  }
}
