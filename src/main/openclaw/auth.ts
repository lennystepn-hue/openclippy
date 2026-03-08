import { shell } from 'electron'
import { exec, execSync } from 'child_process'
import crypto from 'crypto'
import http from 'http'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'

export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

// ---- Claude CLI OAuth (preferred, like GhostClip) ----

/**
 * Check if Claude CLI is installed
 */
function findClaudeCli(): string | null {
  const isWindows = process.platform === 'win32'
  try {
    const result = execSync(isWindows ? 'where claude' : 'which claude', {
      encoding: 'utf-8',
      timeout: 3000
    }).trim().split('\n')[0]
    return result || null
  } catch {
    return null
  }
}

/**
 * Read Claude credentials from standard paths
 * macOS: Keychain (security command)
 * Windows/Linux: ~/.claude/.credentials.json
 */
function readClaudeCredentials(): any | null {
  // Try ~/.claude/.credentials.json first (Linux/Windows, also works on macOS)
  const credsPath = path.join(os.homedir(), '.claude', '.credentials.json')
  try {
    if (fs.existsSync(credsPath)) {
      return JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
    }
  } catch {
    // continue
  }

  // macOS Keychain
  if (process.platform === 'darwin') {
    try {
      const result = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w',
        { encoding: 'utf-8', timeout: 3000 }
      ).trim()
      if (result) return JSON.parse(result)
    } catch {
      // not in keychain
    }
  }

  return null
}

/**
 * Get OAuth token from Claude CLI credentials
 */
export function getOAuthToken(): string | null {
  try {
    const creds = readClaudeCredentials()
    if (!creds) return null

    const oauth = creds.claudeAiOauth
    if (oauth?.accessToken && oauth.expiresAt > Date.now()) {
      return oauth.accessToken
    }
    return null
  } catch {
    return null
  }
}

/**
 * Get OAuth status
 */
export function getOAuthStatus(): { hasToken: boolean; expired: boolean; hasCli: boolean } {
  const hasCli = findClaudeCli() !== null
  try {
    const creds = readClaudeCredentials()
    if (!creds) return { hasToken: false, expired: false, hasCli }
    const oauth = creds.claudeAiOauth
    if (!oauth?.accessToken) return { hasToken: false, expired: false, hasCli }
    if (oauth.expiresAt <= Date.now()) return { hasToken: true, expired: true, hasCli }
    return { hasToken: true, expired: false, hasCli }
  } catch {
    return { hasToken: false, expired: false, hasCli }
  }
}

/**
 * Start Claude OAuth via Claude CLI (like GhostClip)
 * The CLI handles PKCE, code exchange, token storage — everything.
 */
export async function startClaudeOAuthFlow(): Promise<TokenData> {
  const claudePath = findClaudeCli()

  if (!claudePath) {
    throw new Error(
      'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code'
    )
  }

  const beforeToken = getOAuthToken()

  return new Promise((resolve, reject) => {
    const child = exec(`"${claudePath}" auth login`, {
      timeout: 5 * 60 * 1000,
      env: { ...process.env }
    })

    let stderr = ''
    child.stderr?.on('data', (data: string) => {
      stderr += data
    })

    child.on('close', (code) => {
      const afterToken = getOAuthToken()

      if (afterToken && afterToken !== beforeToken) {
        resolve({
          accessToken: afterToken,
          refreshToken: '',
          expiresAt: Date.now() + 3600000
        })
        return
      }

      if (code === 0) {
        // Token write might be async — check after delay
        setTimeout(() => {
          const token = getOAuthToken()
          if (token) {
            resolve({
              accessToken: token,
              refreshToken: '',
              expiresAt: Date.now() + 3600000
            })
          } else {
            reject(new Error('Login completed but no token found. Try again.'))
          }
        }, 1000)
      } else {
        reject(new Error(stderr.trim() || `Claude CLI exited with code ${code}`))
      }
    })

    child.on('error', (err: any) => {
      if (err.code === 'ENOENT') {
        reject(new Error('Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code'))
      } else {
        reject(new Error(err.message))
      }
    })
  })
}

/**
 * Get a valid token — checks Claude CLI credentials first, then local tokens
 */
export async function getValidToken(filePath: string): Promise<string | null> {
  // 1. Try Claude CLI OAuth token (preferred)
  const cliToken = getOAuthToken()
  if (cliToken) return cliToken

  // 2. Fallback to locally stored tokens
  const tokens = loadTokens(filePath)
  if (!tokens) return null

  if (tokens.expiresAt - Date.now() < 300000) {
    // Token expired, can't refresh without CLI
    return null
  }

  return tokens.accessToken
}

// ---- Local token storage (fallback for API keys) ----

export function saveTokens(tokens: TokenData, filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), { mode: 0o600 })
}

export function loadTokens(filePath: string): TokenData | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

/**
 * Setup API key auth for non-OAuth providers
 */
export async function setupApiKey(provider: string, apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`npx openclaw models auth set-key --provider ${provider} --key "${apiKey}"`, {
      timeout: 30000
    }, (err) => resolve(!err))
  })
}
