import { BrowserWindow, BrowserWindowConstructorOptions, screen } from 'electron'
import path from 'path'

export function getClippyWindowConfig(): BrowserWindowConstructorOptions {
  return {
    width: 400,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  }
}

export function createClippyWindow(): BrowserWindow {
  const config = getClippyWindowConfig()
  const win = new BrowserWindow(config)

  // Position bottom-right
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  win.setPosition(screenW - 420, screenH - 620)

  // Make draggable via CSS (-webkit-app-region: drag)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  return win
}
