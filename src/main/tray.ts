import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import path from 'path'
import { PersonalityManager } from './personality'
import { Settings } from './settings'
import { writeSoulFile } from './openclaw/config'

let tray: Tray | null = null

export function createTray(
  clippyWindow: BrowserWindow,
  personality: PersonalityManager,
  settings: Settings
): Tray {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png')
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('OpenClippy')

  const buildMenu = () => {
    const currentMode = personality.currentMode()
    const muted = settings.get('voiceMuted')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show/Hide Clippy',
        click: () => {
          if (clippyWindow.isVisible()) {
            clippyWindow.hide()
          } else {
            clippyWindow.show()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Mode',
        submenu: [
          {
            label: 'Chill',
            type: 'radio',
            checked: currentMode === 'chill',
            click: () => {
              personality.setMode('chill')
              settings.set('personality', 'chill')
              writeSoulFile('chill')
              clippyWindow.webContents.send('clippy:mode-changed', 'chill')
            }
          },
          {
            label: 'Active',
            type: 'radio',
            checked: currentMode === 'active',
            click: () => {
              personality.setMode('active')
              settings.set('personality', 'active')
              writeSoulFile('active')
              clippyWindow.webContents.send('clippy:mode-changed', 'active')
            }
          },
          {
            label: 'Chaos',
            type: 'radio',
            checked: currentMode === 'chaos',
            click: () => {
              personality.setMode('chaos')
              settings.set('personality', 'chaos')
              writeSoulFile('chaos')
              clippyWindow.webContents.send('clippy:mode-changed', 'chaos')
            }
          }
        ]
      },
      {
        label: muted ? 'Unmute Voice' : 'Mute Voice',
        click: () => {
          settings.set('voiceMuted', !muted)
          clippyWindow.webContents.send('settings:changed', { voiceMuted: !muted })
          buildMenu() // Rebuild to update label
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          clippyWindow.show()
          clippyWindow.webContents.send('settings:open')
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        }
      }
    ])

    tray!.setContextMenu(contextMenu)
  }

  buildMenu()

  // Rebuild menu when mode changes (to update radio buttons)
  clippyWindow.webContents.on('ipc-message', (_event, channel) => {
    if (channel === 'clippy:mode') buildMenu()
  })

  tray.on('click', () => {
    if (clippyWindow.isVisible()) {
      clippyWindow.hide()
    } else {
      clippyWindow.show()
    }
  })

  return tray
}
