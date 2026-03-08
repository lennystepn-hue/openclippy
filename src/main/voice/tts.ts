import { exec, ChildProcess } from 'child_process'

export interface TTSEngine {
  name: string
  speak(text: string): Promise<void>
  stop(): void
}

class SystemTTS implements TTSEngine {
  name = 'system'
  private process: ChildProcess | null = null

  async speak(text: string): Promise<void> {
    const clean = text.replace(/["`$\\]/g, '')
    const platform = process.platform

    return new Promise((resolve, reject) => {
      if (platform === 'linux') {
        this.process = exec(`espeak-ng "${clean}"`, (err) => err ? reject(err) : resolve())
      } else if (platform === 'darwin') {
        this.process = exec(`say "${clean}"`, (err) => err ? reject(err) : resolve())
      } else if (platform === 'win32') {
        this.process = exec(`powershell -command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${clean}')"`, (err) => err ? reject(err) : resolve())
      } else {
        resolve()
      }
    })
  }

  stop(): void {
    this.process?.kill()
    this.process = null
  }
}

class OpenAITTS implements TTSEngine {
  name = 'openai'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async speak(text: string): Promise<void> {
    // TODO: Call OpenAI TTS API and play audio
    console.log(`[OpenAI TTS] Would speak: ${text.substring(0, 50)}...`)
  }

  stop(): void {}
}

class ElevenLabsTTS implements TTSEngine {
  name = 'elevenlabs'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async speak(text: string): Promise<void> {
    // TODO: Call ElevenLabs API and play audio
    console.log(`[ElevenLabs TTS] Would speak: ${text.substring(0, 50)}...`)
  }

  stop(): void {}
}

class NullTTS implements TTSEngine {
  name = 'none'
  async speak(): Promise<void> {}
  stop(): void {}
}

export function createTTSEngine(type: string, apiKey?: string): TTSEngine {
  switch (type) {
    case 'system': return new SystemTTS()
    case 'openai': return new OpenAITTS(apiKey ?? '')
    case 'elevenlabs': return new ElevenLabsTTS(apiKey ?? '')
    case 'none': default: return new NullTTS()
  }
}
