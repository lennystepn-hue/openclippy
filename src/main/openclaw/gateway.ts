import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { app } from 'electron'
import { EventEmitter } from 'events'

interface BinResult {
  bin: string
  /** When set, spawn node with this script as first arg instead of running bin directly */
  script?: string
}

function findOpenClawBin(): BinResult | null {
  const isWindows = process.platform === 'win32'
  const ext = isWindows ? '.cmd' : ''
  const candidates: BinResult[] = []

  // OpenClaw requires Node.js 22.12+ and has many npm dependencies.
  // Bundling it inside the asar doesn't work because Node can't resolve
  // dependencies from an unpacked dir when the rest is in asar.
  // Strategy: Use globally installed openclaw, or local node_modules in dev.

  // 1. Global install (works on all platforms — recommended for end users)
  //    Check this FIRST so packaged apps find it reliably
  try {
    const output = execSync(isWindows ? 'where openclaw' : 'which openclaw', {
      encoding: 'utf-8',
      timeout: 3000
    }).trim()
    // `where` on Windows may return multiple lines (openclaw + openclaw.cmd)
    // Prefer the .cmd variant on Windows as it's directly executable via shell
    const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (isWindows) {
      const cmdLine = lines.find(l => l.endsWith('.cmd'))
      candidates.push({ bin: cmdLine || lines[0] })
    } else if (lines[0]) {
      candidates.push({ bin: lines[0] })
    }
  } catch {
    // not globally installed
  }

  // 2. Dev mode: local node_modules
  const devPaths = [
    path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', `openclaw${ext}`),
    path.join(process.cwd(), 'node_modules', '.bin', `openclaw${ext}`)
  ]
  for (const p of devPaths) {
    candidates.push({ bin: p })
  }

  for (const candidate of candidates) {
    try {
      const checkPath = candidate.script || candidate.bin
      if (fs.existsSync(checkPath)) return candidate
    } catch {
      continue
    }
  }

  return null
}

export class OpenClawGateway extends EventEmitter {
  private process: ChildProcess | null = null
  private port: number
  private configPath: string | null = null
  private ready = false

  constructor(port = 19789) {
    super()
    this.port = port
  }

  /**
   * Set the config file path for OpenClaw to use
   */
  setConfigPath(configPath: string): void {
    this.configPath = configPath
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const result = findOpenClawBin()

      if (!result) {
        const err = new Error(
          'OpenClaw binary not found. Please install it globally: npm install -g openclaw'
        )
        this.emit('log', err.message)
        reject(err)
        return
      }

      // Safety: NEVER spawn Electron binary without ELECTRON_RUN_AS_NODE
      // Without it, process.execPath launches a full Electron app → fork bomb
      if (result.bin === process.execPath && !result.script) {
        const err = new Error('SAFETY: Refusing to spawn Electron binary without script (fork bomb risk)')
        this.emit('log', err.message)
        reject(err)
        return
      }

      this.emit('log', `Starting OpenClaw from: ${result.bin}`)
      this.emit('log', `Platform: ${process.platform}, shell: ${process.platform === 'win32' && !result.script}`)

      const gatewayArgs = [
        'gateway',
        '--port', String(this.port),
        '--auth', 'none',              // Local only, no auth needed
        '--bind', 'loopback',          // Only listen on 127.0.0.1
        '--allow-unconfigured'         // Don't require gateway.mode=local in config
      ]

      // If we have a script entry (packaged .mjs), run it with node directly
      const spawnBin = result.bin
      const spawnArgs = result.script
        ? [result.script, ...gatewayArgs]
        : gatewayArgs

      const isWindows = process.platform === 'win32'
      const env = { ...process.env }

      if (this.configPath) {
        env.OPENCLAW_CONFIG_PATH = this.configPath
      }
      // Share state with the global OpenClaw installation so Clippy
      // can use the same API keys, OAuth tokens, and auth profiles
      if (!env.OPENCLAW_STATE_DIR) {
        const globalStateDir = path.join(os.homedir(), '.openclaw')
        if (fs.existsSync(globalStateDir)) {
          env.OPENCLAW_STATE_DIR = globalStateDir
        }
      }

      let settled = false

      // Set CWD to openclaw package dir when running .mjs script directly
      // (openclaw.mjs uses relative imports like ./dist/entry.js)
      const cwd = result.script ? path.dirname(result.script) : undefined

      try {
        this.process = spawn(spawnBin, spawnArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env,
          cwd,
          // Only use shell for .cmd files on Windows, not when running node directly
          shell: isWindows && !result.script
        })
      } catch (err) {
        reject(new Error(`Failed to spawn OpenClaw: ${err}`))
        return
      }

      this.process.on('error', (err) => {
        this.emit('log', `OpenClaw process error: ${err.message}`)
        if (!settled) { settled = true; reject(err) }
      })

      const checkReady = (msg: string) => {
        if (!this.ready && (msg.includes('Gateway ready') || msg.includes('listening on'))) {
          this.ready = true
          this.emit('ready')
          if (!settled) { settled = true; resolve() }
        }
      }

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString()
        checkReady(msg)
        this.emit('log', msg)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString()
        checkReady(msg)
        this.emit('log', `[stderr] ${msg}`)
      })

      this.process.on('exit', (code, signal) => {
        const wasReady = this.ready
        this.ready = false
        this.emit('log', `OpenClaw process exited: code=${code}, signal=${signal}, wasReady=${wasReady}`)
        this.emit('exit', code)
        if (!settled && !wasReady) {
          settled = true
          reject(new Error(`OpenClaw exited with code ${code} (signal: ${signal})`))
        }
      })

      setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new Error('OpenClaw Gateway startup timeout (30s)'))
        }
      }, 30000)
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      // Force kill after 3s if SIGTERM didn't work (especially on Windows)
      const proc = this.process
      setTimeout(() => {
        try { proc.kill('SIGKILL') } catch { /* already dead */ }
      }, 3000)
    }
    this.process = null
    this.ready = false
  }

  isReady(): boolean {
    return this.ready
  }

  getPort(): number {
    return this.port
  }
}
