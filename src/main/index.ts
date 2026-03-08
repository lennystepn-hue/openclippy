import { app, BrowserWindow } from 'electron'
import { createClippyWindow } from './clippy-window'

let clippyWindow: BrowserWindow | null = null

app.whenReady().then(() => {
  clippyWindow = createClippyWindow()
  // Will load renderer later
})

app.on('window-all-closed', () => {
  // Don't quit — Clippy lives in tray
})
