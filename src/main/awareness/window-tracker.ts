import { exec } from 'child_process'
import { EventEmitter } from 'events'

export interface WindowInfo {
  title: string
  appName: string
  category: 'coding' | 'email' | 'browsing' | 'terminal' | 'chat' | 'docs' | 'media' | 'unknown'
  timestamp: number
}

const CATEGORY_RULES: { pattern: RegExp; category: WindowInfo['category'] }[] = [
  { pattern: /Visual Studio Code|VSCode|IntelliJ|WebStorm|Sublime|Atom|Neovim|vim/i, category: 'coding' },
  { pattern: /Gmail|Outlook|Thunderbird|Mail/i, category: 'email' },
  { pattern: /Terminal|Konsole|iTerm|Alacritty|bash|zsh/i, category: 'terminal' },
  { pattern: /Slack|Discord|Telegram|Teams|Signal|Rocket\.Chat/i, category: 'chat' },
  { pattern: /Google Docs|Notion|Obsidian|Word/i, category: 'docs' },
  { pattern: /YouTube|Spotify|Netflix|VLC/i, category: 'media' },
  { pattern: /Chrome|Firefox|Safari|Edge|Brave|Stack Overflow/i, category: 'browsing' }
]

export function parseWindowInfo(title: string, appName: string): WindowInfo {
  let category: WindowInfo['category'] = 'unknown'
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title) || rule.pattern.test(appName)) {
      category = rule.category
      break
    }
  }
  return { title, appName, category, timestamp: Date.now() }
}

export class WindowTracker extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null
  private lastWindow: WindowInfo | null = null
  private history: WindowInfo[] = []
  private maxHistory = 1000

  start(intervalMs = 2000): void {
    this.interval = setInterval(() => this.poll(), intervalMs)
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
  }

  private async poll(): Promise<void> {
    try {
      const info = await this.getActiveWindow()
      if (info && info.title !== this.lastWindow?.title) {
        this.lastWindow = info
        this.history.push(info)
        if (this.history.length > this.maxHistory) this.history.shift()
        this.emit('window-changed', info)
      }
    } catch {
      // Silently ignore polling errors
    }
  }

  private getActiveWindow(): Promise<WindowInfo | null> {
    return new Promise((resolve) => {
      const platform = process.platform

      if (platform === 'linux') {
        exec('xdotool getactivewindow getwindowname 2>/dev/null', (err, titleOut) => {
          if (err) return resolve(null)
          const title = titleOut.trim()
          exec('xdotool getactivewindow getwindowpid 2>/dev/null | xargs -I{} cat /proc/{}/comm 2>/dev/null', (_err2, appOut) => {
            const appName = appOut?.trim() ?? ''
            resolve(parseWindowInfo(title, appName))
          })
        })
      } else if (platform === 'darwin') {
        exec(`osascript -e 'tell application "System Events" to get {name, title} of (first process whose frontmost is true)'`, (err, stdout) => {
          if (err) return resolve(null)
          const parts = stdout.trim().split(', ')
          resolve(parseWindowInfo(parts[1] ?? '', parts[0] ?? ''))
        })
      } else if (platform === 'win32') {
        exec('powershell -command "Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Where-Object {$_.MainWindowTitle} | Select-Object -First 1 ProcessName,MainWindowTitle | ConvertTo-Json"', (err, stdout) => {
          if (err) return resolve(null)
          try {
            const data = JSON.parse(stdout)
            resolve(parseWindowInfo(data.MainWindowTitle ?? '', data.ProcessName ?? ''))
          } catch {
            resolve(null)
          }
        })
      } else {
        resolve(null)
      }
    })
  }

  getHistory(): WindowInfo[] {
    return [...this.history]
  }

  getCurrentWindow(): WindowInfo | null {
    return this.lastWindow
  }
}
