import { shell } from 'electron'
import http from 'http'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { EventEmitter } from 'events'

const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const CLAUDE_AUTH_URL = 'https://claude.ai/oauth/authorize'
const CLAUDE_TOKEN_URL = 'https://claude.ai/oauth/token'
const CALLBACK_PORT = 17833

export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Start the Claude OAuth browser flow.
 * Opens the browser, waits for callback, exchanges code for tokens.
 * Returns the token data.
 */
export async function startClaudeOAuthFlow(): Promise<TokenData> {
  const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`)

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">
            <h2>OpenClippy connected to Claude!</h2>
            <p>You can close this tab. Clippy is ready.</p>
          </body></html>`)

          server.close()

          try {
            // Exchange auth code for tokens
            const tokens = await exchangeCodeForTokens(code, redirectUri)
            resolve(tokens)
          } catch (err) {
            reject(err)
          }
        } else {
          const error = url.searchParams.get('error') || 'Unknown error'
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`<html><body><h2>Authorization failed: ${error}</h2></body></html>`)
          server.close()
          reject(new Error(`OAuth failed: ${error}`))
        }
      }
    })

    server.listen(CALLBACK_PORT, () => {
      const params = new URLSearchParams({
        client_id: CLAUDE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email offline_access',
        state: Math.random().toString(36).substring(7)
      })

      const authUrl = `${CLAUDE_AUTH_URL}?${params.toString()}`
      shell.openExternal(authUrl)
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('Claude OAuth timeout — no callback received within 5 minutes'))
    }, 300000)
  })
}

/**
 * Exchange authorization code for access + refresh tokens
 */
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenData> {
  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLAUDE_CLIENT_ID,
      code,
      redirect_uri: redirectUri
    }).toString()
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as any
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLAUDE_CLIENT_ID,
      refresh_token: refreshToken
    }).toString()
  })

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  const data = await response.json() as any
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in * 1000)
  }
}

/**
 * Store tokens securely in app data directory
 */
export function saveTokens(tokens: TokenData, filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), { mode: 0o600 })
}

/**
 * Load stored tokens
 */
export function loadTokens(filePath: string): TokenData | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

/**
 * Get a valid access token — refresh if expired
 */
export async function getValidToken(filePath: string): Promise<string | null> {
  const tokens = loadTokens(filePath)
  if (!tokens) return null

  // If token expires in less than 5 minutes, refresh
  if (tokens.expiresAt - Date.now() < 300000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken)
      saveTokens(refreshed, filePath)
      return refreshed.accessToken
    } catch {
      return null
    }
  }

  return tokens.accessToken
}

/**
 * Setup API key auth for non-OAuth providers
 */
export async function setupApiKey(provider: string, apiKey: string): Promise<boolean> {
  // Store via OpenClaw CLI
  const { exec } = await import('child_process')
  return new Promise((resolve) => {
    exec(`npx openclaw models auth set-key --provider ${provider} --key "${apiKey}"`, {
      timeout: 30000
    }, (err) => resolve(!err))
  })
}
