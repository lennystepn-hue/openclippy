import { ClippyWidget } from './clippy'
import { initChat } from './chat'
import { SetupWizard } from './wizard'

const GREETINGS = [
  "Hey! Long time no see. Did you miss me? Don't answer that.",
  "I'm back. Try not to break anything while I watch.",
  "Good news: I'm here. Bad news: I have opinions.",
  "It looks like you're starting your computer. Would you like help? ...Just kidding. Or am I?",
  "Another day, another chance to judge your code. Let's go.",
  "I've been thinking about your variable names. We need to talk.",
  "Did you know I was voted 'Most Annoying Software' in 1997? I wear that crown with pride.",
  "Fun fact: I've been reborn as an AI. I can actually help now. Scary, right?",
  "Your friendly neighborhood paperclip reporting for duty.",
  "I noticed you have files on your desktop. We should talk about that.",
  "Back from the dead. Microsoft killed me. Open source brought me back. The circle of life.",
  "Pro tip: Click me to chat. Or don't. I'll talk anyway.",
  "It looks like you're procrastinating. Would you like help with that?",
  "I have access to your terminal now. Sleep well tonight.",
  "Remember when I could only suggest letter templates? Now I can run shell commands. Evolution.",
]

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
      // Normal mode — wave and say something funny
      clippy.playAnimation('Greeting')

      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
      setTimeout(() => {
        clippy.speak(greeting)

        // After greeting, show capabilities
        setTimeout(() => {
          clippy.playAnimation('Explain')
          clippy.speak(
            `<strong>${greeting}</strong><br><br>` +
            `<span style="font-size:11px; color:#555;">` +
            `Click me to chat. I can:<br>` +
            `📝 Write & edit code<br>` +
            `💻 Run terminal commands<br>` +
            `📂 Create, read & delete files<br>` +
            `🔍 Search the web<br>` +
            `🔧 Fix bugs & refactor<br>` +
            `⚡ Automate your workflows<br><br>` +
            `I'll also pop up randomly. You've been warned.</span>`
          )
          // Auto-dismiss after 12 seconds
          setTimeout(() => clippy.dismiss(), 12000)
        }, 4000)
      }, 1500)
    }
  })

  // Always init chat (works alongside wizard)
  initChat(clippy)
}
