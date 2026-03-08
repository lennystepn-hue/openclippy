import { Tray, Menu, BrowserWindow, nativeImage, MenuItemConstructorOptions } from 'electron'
import path from 'path'

let tray: Tray | null = null

export interface TrayMenuItem {
  label?: string
  submenu?: TrayMenuItem[]
  click?: () => void
  type?: 'separator' | 'normal' | 'submenu'
}

export function getTrayMenuTemplate(): TrayMenuItem[] {
  return [
    { label: 'Show/Hide Clippy' },
    { type: 'separator' },
    {
      label: 'Mode',
      submenu: [
        { label: 'Chill' },
        { label: 'Active' },
        { label: 'Chaos' }
      ]
    },
    { label: 'Mute Voice' },
    { type: 'separator' },
    { label: 'Workflows' },
    { label: 'Settings' },
    { type: 'separator' },
    { label: 'Quit' }
  ]
}

export function createTray(clippyWindow: BrowserWindow): Tray {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png')
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('OpenClippy')

  const contextMenu = Menu.buildFromTemplate(
    getTrayMenuTemplate() as MenuItemConstructorOptions[]
  )
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (clippyWindow.isVisible()) {
      clippyWindow.hide()
    } else {
      clippyWindow.show()
    }
  })

  return tray
}
