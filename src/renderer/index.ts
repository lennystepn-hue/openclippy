import { ClippyWidget } from './clippy'
import { initChat } from './chat'
import { SetupWizard } from './wizard'

const container = document.getElementById('clippy-container')
if (container) {
  const clippy = new ClippyWidget(container)

  // Check if first run
  window.clippy.isFirstRun().then((isFirstRun: boolean) => {
    if (isFirstRun) {
      // Show setup wizard
      const bubble = document.getElementById('clippy-bubble')
      if (bubble) {
        const wizard = new SetupWizard(clippy, bubble)
        wizard.start()
      }
    } else {
      // Normal mode — show idle clippy with chat
      clippy.setState('waving')
      setTimeout(() => clippy.setState('idle'), 3000)
    }
  })

  // Always init chat (works alongside wizard)
  initChat(clippy)
}
