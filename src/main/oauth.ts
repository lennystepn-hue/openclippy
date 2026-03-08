import { shell } from 'electron'
import http from 'http'
import { URL } from 'url'

interface OAuthConfig {
  authUrl: string
  scopes: string[]
}

const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    scopes: ['repo', 'read:user']
  },
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/gmail.modify']
  },
  gcal: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/calendar']
  },
  notion: {
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    scopes: []
  },
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    scopes: ['chat:write', 'channels:read']
  }
}

export function getSupportedProviders(): string[] {
  return Object.keys(OAUTH_CONFIGS)
}

export async function startOAuthFlow(provider: string, clientId?: string): Promise<{ code: string }> {
  const config = OAUTH_CONFIGS[provider]
  if (!config) throw new Error(`Unknown OAuth provider: ${provider}`)

  const port = 17832
  const redirectUri = `http://localhost:${port}/callback`

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`)
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>OpenClippy connected!</h2><p>You can close this tab.</p></body></html>')
          server.close()
          resolve({ code })
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Error: No authorization code</h2></body></html>')
          server.close()
          reject(new Error('OAuth failed: no code'))
        }
      }
    })

    server.listen(port, () => {
      const params = new URLSearchParams({
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' ')
      })
      if (clientId) params.set('client_id', clientId)

      const authUrl = `${config.authUrl}?${params.toString()}`
      shell.openExternal(authUrl)
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth timeout — no callback received within 5 minutes'))
    }, 300000)
  })
}
