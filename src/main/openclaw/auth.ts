import { exec } from 'child_process'

export interface AuthProfile {
  provider: string
  type: 'setup-token' | 'api-key' | 'oauth'
  accessToken?: string
  apiKey?: string
  expires?: number
  refreshToken?: string
}

/**
 * Store Claude setup-token for OpenClaw to use.
 * OpenClaw manages auth profiles in ~/.openclaw/agents/<agentId>/agent/auth-profiles.json
 * We invoke the openclaw CLI to set it up properly.
 */
export async function setupClaudeOAuth(setupToken: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use openclaw CLI to store the token
    exec(`echo "${setupToken}" | npx openclaw models auth setup-token --provider anthropic`, {
      timeout: 30000
    }, (err) => {
      if (err) {
        console.error('Failed to setup Claude OAuth:', err)
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

/**
 * Setup API key auth for any provider
 */
export async function setupApiKey(provider: string, apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`npx openclaw models auth set-key --provider ${provider} --key "${apiKey}"`, {
      timeout: 30000
    }, (err) => {
      resolve(!err)
    })
  })
}

/**
 * Check if auth is configured for a provider
 */
export async function checkAuthStatus(): Promise<string> {
  return new Promise((resolve) => {
    exec('npx openclaw models status', { timeout: 15000 }, (err, stdout) => {
      if (err) resolve('not configured')
      else resolve(stdout.trim())
    })
  })
}

/**
 * Get instructions for obtaining the setup token
 */
export function getSetupTokenInstructions(): string {
  return `To get your Claude setup token:

1. Open a terminal
2. Run: claude setup-token
3. Copy the token that appears
4. Paste it here

This uses your Claude Pro/Max subscription — no API key needed.
Token refreshes automatically.`
}
