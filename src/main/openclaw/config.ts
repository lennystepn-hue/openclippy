export interface ClippyUserSettings {
  provider?: string
  apiKey?: string
  oauthToken?: string
  gatewayPort?: number
  personality?: 'chill' | 'active' | 'chaos'
}

export function buildOpenClawConfig(settings: ClippyUserSettings) {
  const port = settings.gatewayPort ?? 18789

  const providers: Record<string, any> = {}
  if (settings.provider && settings.apiKey) {
    providers[settings.provider] = {
      apiKey: settings.apiKey
    }
  }

  return {
    gateway: { port },
    models: { providers },
    memory: {
      path: './data/memory'
    },
    personality: settings.personality ?? 'active'
  }
}
