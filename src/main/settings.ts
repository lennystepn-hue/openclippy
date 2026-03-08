import fs from 'fs'
import path from 'path'

interface SettingsData {
  setupComplete: boolean
  provider: string | null
  apiKey: string | null
  oauthToken: string | null
  visionProvider: string | null
  visionApiKey: string | null
  ttsEngine: 'system' | 'elevenlabs' | 'openai' | null
  ttsApiKey: string | null
  sttEnabled: boolean
  personality: 'chill' | 'active' | 'chaos'
  hotkey: string
  autostart: boolean
  voiceMuted: boolean
  oauthIntegrations: Record<string, { token: string; refreshToken?: string }>
  clippyPosition: { x: number; y: number } | null
  [key: string]: unknown
}

const DEFAULTS: SettingsData = {
  setupComplete: false,
  provider: null,
  apiKey: null,
  oauthToken: null,
  visionProvider: null,
  visionApiKey: null,
  ttsEngine: null,
  ttsApiKey: null,
  sttEnabled: false,
  personality: 'active',
  hotkey: 'CommandOrControl+Shift+C',
  autostart: false,
  voiceMuted: false,
  oauthIntegrations: {},
  clippyPosition: null
}

export class Settings {
  private data: SettingsData
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.data = this.load()
  }

  private load(): SettingsData {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      return { ...DEFAULTS, ...JSON.parse(raw) }
    } catch {
      return { ...DEFAULTS }
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
  }

  get<K extends keyof SettingsData>(key: K): SettingsData[K] {
    return this.data[key]
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value
    this.save()
  }

  isFirstRun(): boolean {
    return !this.data.setupComplete
  }

  getAll(): SettingsData {
    return { ...this.data }
  }
}
