import { EventEmitter } from 'events'
import { exec, ChildProcess } from 'child_process'

export class SpeechToText extends EventEmitter {
  private recording = false
  private process: ChildProcess | null = null
  private useLocalWhisper: boolean

  constructor(useLocal = false) {
    super()
    this.useLocalWhisper = useLocal
  }

  startListening(): void {
    if (this.recording) return
    this.recording = true
    this.emit('listening')

    const tmpFile = '/tmp/openclippy-stt.wav'
    const platform = process.platform

    if (platform === 'linux') {
      this.process = exec(`arecord -f S16_LE -r 16000 -d 10 ${tmpFile}`)
    } else if (platform === 'darwin') {
      this.process = exec(`rec ${tmpFile} trim 0 10`)
    } else if (platform === 'win32') {
      // Windows: use powershell for recording
      this.process = exec(`powershell -command "Add-Type -AssemblyName System.Speech; $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine; $r.SetInputToDefaultAudioDevice(); $r.RecognizeAsync()"`)
    }

    this.process?.on('exit', () => {
      this.recording = false
      this.transcribe(tmpFile)
    })
  }

  stopListening(): void {
    this.process?.kill('SIGTERM')
    this.process = null
    this.recording = false
  }

  private async transcribe(audioFile: string): Promise<void> {
    try {
      if (this.useLocalWhisper) {
        exec(`whisper-cpp -m /usr/local/share/whisper/ggml-base.bin -f ${audioFile}`, (err, stdout) => {
          if (!err) this.emit('transcription', stdout.trim())
        })
      } else {
        this.emit('transcribe-request', audioFile)
      }
    } catch (err) {
      this.emit('error', err)
    }
  }

  isListening(): boolean {
    return this.recording
  }
}
