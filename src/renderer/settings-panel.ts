import { ClippyWidget } from './clippy'

interface SettingsSection {
  title: string
  icon: string
  fields: SettingsField[]
}

interface SettingsField {
  key: string
  label: string
  type: 'select' | 'text' | 'password' | 'toggle' | 'hotkey' | 'info' | 'oauth-button'
  options?: { value: string; label: string }[]
  placeholder?: string
}

const SECTIONS: SettingsSection[] = [
  {
    title: 'AI Model',
    icon: '🤖',
    fields: [
      {
        key: 'provider', label: 'Provider', type: 'select',
        options: [
          { value: 'claude-oauth', label: 'Claude Pro/Max (OAuth)' },
          { value: 'openai-oauth', label: 'ChatGPT (OAuth)' },
          { value: 'anthropic-api', label: 'Claude (API Key)' },
          { value: 'deepseek', label: 'DeepSeek (API Key)' },
          { value: 'ollama', label: 'Ollama (Local)' },
          { value: 'custom', label: 'Custom OpenAI-compatible' }
        ]
      },
      { key: 'claude-login', label: 'Login with Claude', type: 'oauth-button' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' }
    ]
  },
  {
    title: 'Personality',
    icon: '🎭',
    fields: [
      {
        key: 'personality', label: 'Mode', type: 'select',
        options: [
          { value: 'chill', label: 'Chill — I only talk when it matters' },
          { value: 'active', label: 'Active — I comment, suggest, and joke' },
          { value: 'chaos', label: 'Chaos — I do things. I ask later.' }
        ]
      }
    ]
  },
  {
    title: 'Vision',
    icon: '👁',
    fields: [
      {
        key: 'visionProvider', label: 'Vision Provider', type: 'select',
        options: [
          { value: 'none', label: 'Disabled' },
          { value: 'same', label: 'Same as AI Model' },
          { value: 'anthropic', label: 'Claude Vision' },
          { value: 'openai', label: 'GPT-4o Vision' }
        ]
      },
      { key: 'visionApiKey', label: 'Vision API Key', type: 'password' }
    ]
  },
  {
    title: 'Voice',
    icon: '🔊',
    fields: [
      {
        key: 'ttsEngine', label: 'Text-to-Speech', type: 'select',
        options: [
          { value: 'none', label: 'Disabled' },
          { value: 'system', label: 'System TTS (free)' },
          { value: 'openai', label: 'OpenAI TTS' },
          { value: 'elevenlabs', label: 'ElevenLabs' }
        ]
      },
      { key: 'ttsApiKey', label: 'TTS API Key', type: 'password' },
      { key: 'sttEnabled', label: 'Speech-to-Text (Hey Clippy)', type: 'toggle' },
      { key: 'voiceMuted', label: 'Mute Voice', type: 'toggle' }
    ]
  },
  {
    title: 'General',
    icon: '⚙',
    fields: [
      { key: 'openclaw-status', label: 'OpenClaw Engine', type: 'info' },
      { key: 'hotkey', label: 'Global Hotkey', type: 'hotkey' },
      { key: 'autostart', label: 'Start with system', type: 'toggle' }
    ]
  }
]

export class SettingsPanel {
  private clippy: ClippyWidget
  private currentData: Record<string, any> = {}
  private activeSection = 0
  private isOpen = false

  constructor(clippy: ClippyWidget) {
    this.clippy = clippy

    window.clippy.onSettingsSaved(() => {
      this.showSavedFeedback()
    })
  }

  async open(): Promise<void> {
    this.isOpen = true
    this.currentData = await window.clippy.getSettings()
    this.render()
  }

  close(): void {
    this.isOpen = false
    this.clippy.dismiss()
  }

  isVisible(): boolean {
    return this.isOpen
  }

  private render(): void {
    const section = SECTIONS[this.activeSection]
    const tabs = SECTIONS.map((s, i) =>
      `<span class="settings-tab${i === this.activeSection ? ' active' : ''}" data-tab="${i}">${s.icon}</span>`
    ).join('')

    const fields = section.fields.map(f => this.renderField(f)).join('')

    const html = `
      <div class="settings-panel">
        <div class="settings-header">
          <span class="settings-title">Settings</span>
          <span class="settings-close" title="Close">✕</span>
        </div>
        <div class="settings-tabs">${tabs}</div>
        <div class="settings-section-title">${section.icon} ${section.title}</div>
        <div class="settings-fields">${fields}</div>
        <div class="settings-footer">
          <button class="settings-save-btn">Save</button>
          <button class="settings-rerun-btn" title="Re-run Setup Wizard">Re-run Wizard</button>
        </div>
      </div>
    `

    this.clippy.speak(html)
    this.bindEvents()
    this.checkOpenClaw()
  }

  private renderField(field: SettingsField): string {
    const value = this.currentData[field.key]

    switch (field.type) {
      case 'select': {
        const opts = (field.options ?? []).map(opt =>
          `<option value="${opt.value}"${value === opt.value ? ' selected' : ''}>${opt.label}</option>`
        ).join('')
        return `
          <div class="settings-field">
            <label>${field.label}</label>
            <select data-key="${field.key}">${opts}</select>
          </div>`
      }
      case 'text':
      case 'password': {
        const ph = field.placeholder ? ` placeholder="${field.placeholder}"` : ''
        return `
          <div class="settings-field">
            <label>${field.label}</label>
            <input type="${field.type}" data-key="${field.key}" value="${value ?? ''}"${ph} />
          </div>`
      }
      case 'toggle': {
        return `
          <div class="settings-field settings-toggle">
            <label>
              <input type="checkbox" data-key="${field.key}"${value ? ' checked' : ''} />
              ${field.label}
            </label>
          </div>`
      }
      case 'hotkey': {
        return `
          <div class="settings-field">
            <label>${field.label}</label>
            <input type="text" data-key="${field.key}" value="${value ?? 'Ctrl+Shift+C'}" class="hotkey-input" readonly />
          </div>`
      }
      case 'oauth-button': {
        const authed = this.currentData.provider === 'claude-oauth'
        return `
          <div class="settings-field">
            <button class="wizard-oauth-btn${authed ? ' oauth-connected' : ''}" data-key="${field.key}">
              ${authed ? 'Claude Connected ✓' : field.label}
            </button>
          </div>`
      }
      case 'info': {
        if (field.key === 'openclaw-status') {
          return `
            <div class="settings-field">
              <label>${field.label}</label>
              <div id="settings-openclaw-status" style="font-size: 12px; color: #888;">Checking...</div>
            </div>`
        }
        return ''
      }
      default:
        return ''
    }
  }

  private bindEvents(): void {
    const panel = document.querySelector('.settings-panel')
    if (!panel) return

    // Tab switching
    panel.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.collectFields()
        this.activeSection = parseInt((tab as HTMLElement).dataset.tab!)
        this.render()
      })
    })

    // Close button
    panel.querySelector('.settings-close')?.addEventListener('click', () => {
      this.close()
    })

    // Save button
    panel.querySelector('.settings-save-btn')?.addEventListener('click', () => {
      this.collectFields()
      window.clippy.updateSettings(this.currentData)
    })

    // Re-run wizard
    panel.querySelector('.settings-rerun-btn')?.addEventListener('click', () => {
      this.close()
      window.clippy.resetSetup()
    })

    // OAuth button
    panel.querySelectorAll('.wizard-oauth-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = (btn as HTMLElement).dataset.key
        if (key === 'claude-login') {
          btn.textContent = 'Logging in...'
          btn.classList.add('oauth-pending')
          const result = await window.clippy.startClaudeLogin()
          btn.classList.remove('oauth-pending')
          if (result.success) {
            btn.classList.add('oauth-connected')
            btn.textContent = 'Claude Connected ✓'
          } else {
            btn.textContent = 'Login with Claude'
          }
        }
      })
    })

    // Hotkey input
    panel.querySelectorAll('.hotkey-input').forEach(input => {
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
  }

  private collectFields(): void {
    const panel = document.querySelector('.settings-panel')
    if (!panel) return

    panel.querySelectorAll('[data-key]').forEach(el => {
      const key = (el as HTMLElement).dataset.key!
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        this.currentData[key] = el.checked
      } else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        if (el.value) this.currentData[key] = el.value
      }
    })
  }

  private async checkOpenClaw(): Promise<void> {
    const el = document.querySelector('#settings-openclaw-status')
    if (!el) return
    const result = await window.clippy.checkOpenClaw()
    if (result.installed) {
      el.innerHTML = `<span style="color: #2e7d32; font-weight: bold;">Installed ${result.version ? `(${result.version})` : ''}</span>`
    } else {
      el.innerHTML = `<span style="color: #d32f2f; font-weight: bold;">Not found</span> — run: <code>npm install -g openclaw</code>`
    }
  }

  private showSavedFeedback(): void {
    const btn = document.querySelector('.settings-save-btn') as HTMLElement
    if (btn) {
      const orig = btn.textContent
      btn.textContent = 'Saved ✓'
      btn.style.background = '#4caf50'
      btn.style.color = '#fff'
      setTimeout(() => {
        btn.textContent = orig
        btn.style.background = ''
        btn.style.color = ''
      }, 1500)
    }
  }
}
