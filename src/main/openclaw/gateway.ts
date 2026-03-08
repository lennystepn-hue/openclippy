import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { EventEmitter } from 'events'

function findOpenClawBin(): string | null {
  const isWindows = process.platform === 'win32'
  const ext = isWindows ? '.cmd' : ''
  const candidates: string[] = []

  // 1. Packaged app: unpacked from asar
  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '.bin', `openclaw${ext}`)
    )
  }

  // 2. Dev mode: local node_modules
  candidates.push(
    path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', `openclaw${ext}`),
    path.join(process.cwd(), 'node_modules', '.bin', `openclaw${ext}`)
  )

  // 3. Global install
  try {
    const globalPath = execSync(isWindows ? 'where openclaw' : 'which openclaw', {
      encoding: 'utf-8',
      timeout: 3000
    }).trim().split('\n')[0]
    if (globalPath) candidates.push(globalPath)
  } catch {
    // not globally installed
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate
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

  constructor(port = 18789) {
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
      const binPath = findOpenClawBin()

      if (!binPath) {
        const err = new Error(
          'OpenClaw binary not found. Please install it globally: npm install -g openclaw'
        )
        this.emit('log', err.message)
        reject(err)
        return
      }

      this.emit('log', `Starting OpenClaw from: ${binPath}`)

      const args = ['start', '--port', String(this.port)]
      if (this.configPath) {
        args.push('--config', this.configPath)
      }

      const isWindows = process.platform === 'win32'
      try {
        this.process = spawn(binPath, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
          shell: isWindows
        })
      } catch (err) {
        reject(new Error(`Failed to spawn OpenClaw: ${err}`))
        return
      }

      this.process.on('error', (err) => {
        this.emit('log', `OpenClaw process error: ${err.message}`)
        if (!this.ready) reject(err)
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString()
        if (!this.ready && (msg.includes('Gateway ready') || msg.includes('listening'))) {
          this.ready = true
          this.emit('ready')
          resolve()
        }
        this.emit('log', msg)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.emit('log', `[stderr] ${data.toString()}`)
      })

      this.process.on('exit', (code) => {
        this.ready = false
        this.emit('exit', code)
        if (!this.ready) reject(new Error(`OpenClaw exited with code ${code}`))
      })

      setTimeout(() => {
        if (!this.ready) reject(new Error('OpenClaw Gateway startup timeout (30s)'))
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
