import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { EventEmitter } from 'events'

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
      const binPath = path.join(__dirname, '../../..', 'node_modules', '.bin', 'openclaw')
      this.process = spawn(binPath, ['start', '--port', String(this.port)], {
        cwd: path.join(__dirname, '../../..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
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
