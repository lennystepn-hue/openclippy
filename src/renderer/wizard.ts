import { ClippyWidget } from './clippy'
import { WizardFlow, WizardField } from './wizard-steps'

export class SetupWizard {
  private flow: WizardFlow
  private clippy: ClippyWidget
  private container: HTMLElement
  private formData: Record<string, string | boolean> = {}

  constructor(clippy: ClippyWidget, container: HTMLElement) {
    this.clippy = clippy
    this.container = container
    this.flow = new WizardFlow()
  }

  start(): void {
    this.renderCurrentStep()
  }

  private renderCurrentStep(): void {
    const stepDef = this.flow.currentStepDef()
    const stepNum = this.flow.currentStep() + 1
    const totalSteps = 8

    const fieldsHtml = stepDef.fields.map(field => this.renderField(field)).join('')

    const progressHtml = `<div class="wizard-progress">Step ${stepNum} / ${totalSteps}</div>`

    const backBtn = this.flow.hasPrev()
      ? `<button class="wizard-btn wizard-back">Back</button>`
      : ''

    const nextBtn = this.flow.isComplete()
      ? `<button class="wizard-btn wizard-finish">Finish</button>`
      : `<button class="wizard-btn wizard-next">Next</button>`

    const html = `
      <div class="wizard-step" data-step="${stepDef.name}">
        ${progressHtml}
        <div class="wizard-title">${stepDef.title}</div>
        <div class="wizard-clippy-says">${stepDef.clippySays}</div>
        <div class="wizard-fields">${fieldsHtml}</div>
        <div class="wizard-nav">${backBtn}${nextBtn}</div>
      </div>
    `

    this.clippy.speak(html)
    this.bindEvents()
  }

  private renderField(field: WizardField): string {
    switch (field.type) {
      case 'select':
        return this.renderSelect(field)
      case 'text':
        return this.renderTextInput(field, 'text')
      case 'password':
        return this.renderTextInput(field, 'password')
      case 'oauth-button':
        return this.renderOAuthButton(field)
      case 'toggle':
        return this.renderToggle(field)
      case 'hotkey':
        return this.renderHotkeyInput(field)
      case 'openclaw-check':
        return this.renderOpenClawCheck()
      default:
        return ''
    }
  }

  private renderSelect(field: WizardField): string {
    const options = (field.options ?? [])
      .map(opt => {
        const selected = this.formData[field.name] === opt.value ? ' selected' : ''
        return `<option value="${opt.value}"${selected}>${opt.label}</option>`
      })
      .join('')

    return `
      <div class="wizard-field">
        <label>${field.label}</label>
        <select data-field="${field.name}">${options}</select>
      </div>
    `
  }

  private renderTextInput(field: WizardField, type: string): string {
    const value = (this.formData[field.name] as string) ?? ''
    const placeholder = field.placeholder ? ` placeholder="${field.placeholder}"` : ''
    return `
      <div class="wizard-field">
        <label>${field.label}${field.optional ? ' (optional)' : ''}</label>
        <input type="${type}" data-field="${field.name}" value="${value}"${placeholder} />
      </div>
    `
  }

  private renderOAuthButton(field: WizardField): string {
    const connected = this.formData[field.name] === true
    const btnClass = connected ? 'oauth-connected' : ''
    const btnText = connected ? `${field.label} ✓` : field.label
    return `
      <div class="wizard-field">
        <button class="wizard-oauth-btn ${btnClass}" data-field="${field.name}">${btnText}</button>
      </div>
    `
  }

  private renderToggle(field: WizardField): string {
    const checked = this.formData[field.name] === true ? ' checked' : ''
    return `
      <div class="wizard-field wizard-toggle">
        <label>
          <input type="checkbox" data-field="${field.name}"${checked} />
          ${field.label}
        </label>
      </div>
    `
  }

  private renderOpenClawCheck(): string {
    const status = this.formData['openclaw-installed']
    if (status === true) {
      const version = this.formData['openclaw-version'] || ''
      return `
        <div class="wizard-field">
          <div class="wizard-complete">OpenClaw is installed ${version ? `(${version})` : ''}</div>
        </div>`
    }

    return `
      <div class="wizard-field">
        <div id="openclaw-status">Checking...</div>
        <div style="margin-top: 10px; font-size: 12px; color: #555;">
          <strong>OpenClaw must be installed globally:</strong>
          <pre style="margin: 6px 0; padding: 8px; background: #1e1e1e; color: #d4d4d4; border-radius: 4px; font-size: 11px;">npm install -g openclaw</pre>
          <div style="margin-top: 4px;">Requires <strong>Node.js 22.12+</strong> — download: <span class="chat-link" data-url="https://nodejs.org">nodejs.org</span></div>
        </div>
        <button class="wizard-oauth-btn" id="openclaw-recheck" style="margin-top: 10px;">Check again</button>
      </div>`
  }

  private renderHotkeyInput(field: WizardField): string {
    const value = (this.formData[field.name] as string) ?? 'Ctrl+Shift+C'
    return `
      <div class="wizard-field">
        <label>${field.label}</label>
        <input type="text" data-field="${field.name}" value="${value}" class="hotkey-input" readonly />
      </div>
    `
  }

  private bindEvents(): void {
    // Next button — block on openclaw step if not installed
    const nextBtn = this.container.querySelector('.wizard-next')
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.flow.currentStepName() === 'openclaw' && !this.formData['openclaw-installed']) {
          const statusEl = this.container.querySelector('#openclaw-status')
          if (statusEl) statusEl.innerHTML = '<span class="wizard-error">Please install OpenClaw first!</span>'
          return
        }
        this.collectCurrentFields()
        this.flow.next()
        this.renderCurrentStep()
      })
    }

    // Back button
    const backBtn = this.container.querySelector('.wizard-back')
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.collectCurrentFields()
        this.flow.back()
        this.renderCurrentStep()
      })
    }

    // Finish button
    const finishBtn = this.container.querySelector('.wizard-finish')
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        this.collectCurrentFields()
        this.finish()
      })
    }

    // Hotkey input — capture key combos
    const hotkeyInputs = this.container.querySelectorAll('.hotkey-input')
    hotkeyInputs.forEach(input => {
      input.addEventListener('keydown', (e: Event) => {
        const ke = e as KeyboardEvent
        ke.preventDefault()
        const parts: string[] = []
        if (ke.ctrlKey) parts.push('Ctrl')
        if (ke.shiftKey) parts.push('Shift')
        if (ke.altKey) parts.push('Alt')
        if (ke.metaKey) parts.push('Meta')
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(ke.key)) {
          parts.push(ke.key.toUpperCase())
        }
        if (parts.length > 0) {
          (input as HTMLInputElement).value = parts.join('+')
        }
      })
    })

    // OpenClaw check — auto-run on step render
    const statusEl = this.container.querySelector('#openclaw-status')
    if (statusEl) {
      this.runOpenClawCheck()
    }
    const recheckBtn = this.container.querySelector('#openclaw-recheck')
    if (recheckBtn) {
      recheckBtn.addEventListener('click', () => this.runOpenClawCheck())
    }

    // Clickable links in wizard
    this.container.querySelectorAll('.chat-link[data-url]').forEach(link => {
      link.addEventListener('click', () => {
        const url = (link as HTMLElement).dataset.url
        if (url) window.clippy.openExternal(url)
      })
    })

    // OAuth buttons — mark as connected on click
    const oauthBtns = this.container.querySelectorAll('.wizard-oauth-btn:not(#openclaw-recheck)')
    oauthBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const fieldName = (btn as HTMLElement).dataset.field!

        if (fieldName === 'claude-login') {
          btn.textContent = 'Logging in...'
          btn.classList.add('oauth-pending')
          const result = await window.clippy.startClaudeLogin()
          btn.classList.remove('oauth-pending')
          if (result.success) {
            this.formData[fieldName] = true
            btn.classList.add('oauth-connected')
            btn.textContent = 'Login with Claude ✓'
          } else {
            btn.textContent = 'Login with Claude'
            this.clippy.speak(
              `<div class="wizard-error">Claude login failed: ${result.error || 'Unknown error'}. Try again.</div>`
            )
          }
          return
        }

        this.formData[fieldName] = true
        btn.classList.add('oauth-connected')
        btn.textContent = `${btn.textContent?.replace(' ✓', '')} ✓`
      })
    })
  }

  private async runOpenClawCheck(): Promise<void> {
    const statusEl = this.container.querySelector('#openclaw-status')
    const recheckBtn = this.container.querySelector('#openclaw-recheck')
    if (statusEl) statusEl.innerHTML = '<em>Checking...</em>'
    if (recheckBtn) (recheckBtn as HTMLButtonElement).disabled = true

    const result = await window.clippy.checkOpenClaw()

    if (result.installed) {
      this.formData['openclaw-installed'] = true
      this.formData['openclaw-version'] = result.version || ''
      // Re-render to show success state
      this.renderCurrentStep()
    } else {
      if (statusEl) {
        statusEl.innerHTML = '<span class="wizard-error">OpenClaw not found!</span>'
      }
      if (recheckBtn) (recheckBtn as HTMLButtonElement).disabled = false
    }
  }

  private collectCurrentFields(): void {
    const stepDef = this.flow.currentStepDef()
    for (const field of stepDef.fields) {
      const el = this.container.querySelector(`[data-field="${field.name}"]`)
      if (!el) continue

      if (field.type === 'toggle') {
        this.formData[field.name] = (el as HTMLInputElement).checked
      } else if (field.type === 'oauth-button') {
        // OAuth state is tracked via click handler
      } else {
        const value = (el as HTMLInputElement | HTMLSelectElement).value
        if (value) {
          this.formData[field.name] = value
        }
      }
    }
  }

  private async finish(): Promise<void> {
    // Claude OAuth — login already happened via the button click, just complete
    if (this.formData.provider === 'claude-oauth' && !this.formData['claude-login']) {
      this.clippy.speak(
        '<div class="wizard-error">Please click "Login with Claude" first!</div>'
      )
      return
    }

    // Handle API key setup for providers that need it
    if (this.formData.apiKey && this.formData.provider) {
      const provider = this.formData.provider as string
      if (['anthropic-api', 'deepseek', 'custom'].includes(provider)) {
        await window.clippy.setupApiKey(provider, this.formData.apiKey as string)
      }
    }

    window.clippy.completeSetup(this.formData)

    this.clippy.speak(
      '<div class="wizard-complete">All set! Ignore me or use me — I\'m here either way.</div>'
    )
  }

  getFormData(): Record<string, string | boolean> {
    return { ...this.formData }
  }
}
