export interface WizardStepDef {
  name: string
  title: string
  clippySays: string
  fields: WizardField[]
}

export interface WizardField {
  type: 'select' | 'text' | 'password' | 'oauth-button' | 'toggle' | 'hotkey' | 'openclaw-check'
  name: string
  label: string
  options?: { value: string; label: string }[]
  placeholder?: string
  optional?: boolean
}

export const WIZARD_STEPS: WizardStepDef[] = [
  {
    name: 'openclaw',
    title: 'OpenClaw Engine',
    clippySays: 'Erstmal checken ob mein Gehirn installiert ist...',
    fields: [
      { type: 'openclaw-check', name: 'openclaw-status', label: 'OpenClaw Status' }
    ]
  },
  {
    name: 'ai-model',
    title: 'AI Model',
    clippySays: 'Hey! Ich bin Clippy. Lange nicht gesehen... Klick einfach auf Login with Claude und ich bin connected!',
    fields: [
      {
        type: 'select', name: 'provider', label: 'Provider',
        options: [
          { value: 'claude-oauth', label: 'Claude Pro/Max (OAuth — recommended)' },
          { value: 'openai-oauth', label: 'ChatGPT (OAuth Login)' },
          { value: 'anthropic-api', label: 'Claude (API Key)' },
          { value: 'deepseek', label: 'DeepSeek (API Key)' },
          { value: 'ollama', label: 'Ollama (Local, free)' },
          { value: 'custom', label: 'Custom OpenAI-compatible' }
        ]
      },
      { type: 'oauth-button', name: 'claude-login', label: 'Login with Claude' },
      { type: 'password', name: 'apiKey', label: 'API Key', placeholder: 'sk-...', optional: true }
    ]
  },
  {
    name: 'vision',
    title: 'Vision (Screen Awareness)',
    clippySays: 'Soll ich sehen koennen was du machst? Brauche dafuer ein Vision Model.',
    fields: [
      {
        type: 'select', name: 'visionProvider', label: 'Vision Provider',
        options: [
          { value: 'none', label: 'Disabled (no screenshots)' },
          { value: 'same', label: 'Same as AI Model' },
          { value: 'anthropic', label: 'Claude Vision (API Key)' },
          { value: 'openai', label: 'GPT-4o Vision (API Key)' }
        ]
      },
      { type: 'password', name: 'visionApiKey', label: 'Vision API Key', optional: true }
    ]
  },
  {
    name: 'voice',
    title: 'Voice',
    clippySays: 'Soll ich reden koennen? Und willst du mit mir sprechen?',
    fields: [
      {
        type: 'select', name: 'ttsEngine', label: 'Text-to-Speech',
        options: [
          { value: 'none', label: 'Disabled' },
          { value: 'system', label: 'System TTS (free)' },
          { value: 'openai', label: 'OpenAI TTS' },
          { value: 'elevenlabs', label: 'ElevenLabs' }
        ]
      },
      { type: 'password', name: 'ttsApiKey', label: 'TTS API Key', optional: true },
      { type: 'toggle', name: 'sttEnabled', label: 'Speech-to-Text (Hey Clippy)' }
    ]
  },
  {
    name: 'integrations',
    title: 'Integrations',
    clippySays: 'Welche Apps soll ich anbinden? Klick einfach auf Connect.',
    fields: [
      { type: 'oauth-button', name: 'github', label: 'Connect GitHub' },
      { type: 'oauth-button', name: 'gmail', label: 'Connect Gmail' },
      { type: 'oauth-button', name: 'gcal', label: 'Connect Google Calendar' },
      { type: 'oauth-button', name: 'notion', label: 'Connect Notion' },
      { type: 'oauth-button', name: 'slack', label: 'Connect Slack' }
    ]
  },
  {
    name: 'personality',
    title: 'Personality',
    clippySays: 'Wie soll ich drauf sein?',
    fields: [
      {
        type: 'select', name: 'personality', label: 'Mode',
        options: [
          { value: 'chill', label: 'Chill — I only talk when it matters' },
          { value: 'active', label: 'Active — I comment, suggest, and joke around' },
          { value: 'chaos', label: 'Chaos — I do things. I ask later. Good luck.' }
        ]
      }
    ]
  },
  {
    name: 'hotkeys',
    title: 'Hotkeys',
    clippySays: 'Wie rufst du mich? Standard ist Ctrl+Shift+C.',
    fields: [
      { type: 'hotkey', name: 'hotkey', label: 'Global Hotkey' }
    ]
  },
  {
    name: 'autostart',
    title: 'Autostart',
    clippySays: 'Soll ich immer da sein wenn du den Rechner anmachst?',
    fields: [
      { type: 'toggle', name: 'autostart', label: 'Start with system' }
    ]
  }
]

export class WizardFlow {
  private step = 0

  currentStep(): number { return this.step }
  currentStepName(): string { return WIZARD_STEPS[this.step].name }
  currentStepDef(): WizardStepDef { return WIZARD_STEPS[this.step] }
  hasNext(): boolean { return this.step < WIZARD_STEPS.length - 1 }
  hasPrev(): boolean { return this.step > 0 }
  next(): void { if (this.hasNext()) this.step++ }
  back(): void { if (this.hasPrev()) this.step-- }
  isComplete(): boolean { return this.step === WIZARD_STEPS.length - 1 }
}
