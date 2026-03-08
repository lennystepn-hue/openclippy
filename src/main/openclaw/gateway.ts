import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { app } from 'electron'
import { EventEmitter } from 'events'

function findOpenClawBin(): string {
  // In packaged app: resources/app.asar.unpacked/node_modules/.bin/openclaw
  const isPackaged = app.isPackaged
  const basePath = isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : path.join(__dirname, '../../..')

  const ext = process.platform === 'win32' ? '.cmd' : ''
  return path.join(basePath, 'node_modules', '.bin', `openclaw${ext}`)
}

export class OpenClawGateway extends EventEmitter {
  private process: ChildProcess | null = null
  private port: number
  private ready = false

  constructor(port = 18789) {
    super()
    this.port = port
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const binPath = findOpenClawBin()
      const isWindows = process.platform === 'win32'
      this.process = spawn(binPath, ['start', '--port', String(this.port)], {
        cwd: path.dirname(path.dirname(binPath)),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        shell: isWindows
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString()
        if (msg.includes('Gateway ready') || msg.includes('listening')) {
          this.ready = true
          this.emit('ready')
          resolve()
        }
        this.emit('log', msg)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.emit('error', data.toString())
      })

      this.process.on('exit', (code) => {
        this.ready = false
        this.emit('exit', code)
      })

      setTimeout(() => {
        if (!this.ready) reject(new Error('OpenClaw Gateway startup timeout'))
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
