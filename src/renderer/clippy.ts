import { AnimationStateMachine, ClippyState } from './animations'
// @ts-ignore - PNG import handled by Vite
import spriteMapUrl from '../../assets/sprites/clippy-map.png'

export class ClippyWidget {
  private container: HTMLElement
  private spriteEl: HTMLElement
  private bubbleEl: HTMLElement
  private animationSM: AnimationStateMachine

  constructor(container: HTMLElement) {
    this.container = container
    this.animationSM = new AnimationStateMachine((state) => this.onStateChange(state))
    this.spriteEl = this.createSpriteElement()
    this.bubbleEl = this.createBubbleElement()
    container.appendChild(this.bubbleEl)
    container.appendChild(this.spriteEl)
  }

  private createSpriteElement(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'clippy-sprite'
    el.className = 'clippy-sprite clippy-idle'
    el.style.cssText = `-webkit-app-region: drag; cursor: grab; background-image: url('${spriteMapUrl}');`
    // Double-click toggles chat
    el.addEventListener('dblclick', () => this.toggleChat())
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

  setState(state: ClippyState): void {
    this.animationSM.transition(state)
  }

  speak(text: string, actions?: { label: string; onClick: () => void }[]): void {
    const content = this.bubbleEl.querySelector('.bubble-content') as HTMLElement
    content.innerHTML = text
    this.bubbleEl.classList.remove('hidden')
    this.animationSM.transition('talking')

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
    this.animationSM.transition('idle')
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

  private onStateChange(state: ClippyState): void {
    this.spriteEl.className = `clippy-sprite clippy-${state}`
  }
}
