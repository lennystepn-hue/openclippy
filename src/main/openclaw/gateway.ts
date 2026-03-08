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

  // 1. Packaged app: prefer running the .mjs entry directly with Electron's node
  //    This avoids .cmd shim issues on Windows where node.exe may not be on PATH
  if (app.isPackaged) {
    const unpackedDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
    const mjsEntry = path.join(unpackedDir, 'openclaw', 'openclaw.mjs')
    if (fs.existsSync(mjsEntry)) {
      candidates.push({ bin: process.execPath, script: mjsEntry })
    }
    // Fallback to .bin shim
    candidates.push({
      bin: path.join(unpackedDir, '.bin', `openclaw${ext}`)
    })
  }

  // 2. Dev mode: local node_modules
  const devPaths = [
    path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', `openclaw${ext}`),
    path.join(process.cwd(), 'node_modules', '.bin', `openclaw${ext}`)
  ]
  for (const p of devPaths) {
    candidates.push({ bin: p })
  }

  // 3. Global install
  try {
    const globalPath = execSync(isWindows ? 'where openclaw' : 'which openclaw', {
      encoding: 'utf-8',
      timeout: 3000
    }).trim().split('\n')[0]
    if (globalPath) candidates.push({ bin: globalPath })
  } catch {
    // not globally installed
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

      this.emit('log', `Starting OpenClaw from: ${result.script || result.bin}`)

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

      try {
        this.process = spawn(spawnBin, spawnArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env,
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

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString()
        if (!this.ready && (msg.includes('Gateway ready') || msg.includes('listening'))) {
          this.ready = true
          this.emit('ready')
          if (!settled) { settled = true; resolve() }
        }
        this.emit('log', msg)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.emit('log', `[stderr] ${data.toString()}`)
      })

      this.process.on('exit', (code) => {
        const wasReady = this.ready
        this.ready = false
        this.emit('exit', code)
        if (!settled && !wasReady) {
          settled = true
          reject(new Error(`OpenClaw exited with code ${code}`))
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
    this.process?.kill('SIGTERM')
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
