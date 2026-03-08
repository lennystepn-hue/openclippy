export interface EasterEgg {
  message: string
  animation?: string
  sound?: string
}

interface EasterEggTrigger {
  type: string
  app?: string
  text?: string
  time?: Date
}

interface EasterEggRule {
  match: (trigger: EasterEggTrigger) => boolean
  egg: EasterEgg
}

const RULES: EasterEggRule[] = [
  {
    match: (t) => t.type === 'app-opened' && /Gmail|Outlook|Mail|Thunderbird/i.test(t.app ?? ''),
    egg: { message: "It looks like you're writing a letter. Would you like help?", animation: 'talking', sound: 'clippy-popup.wav' }
  },
  {
    match: (t) => {
      if (t.type !== 'time-check' || !t.time) return false
      return t.time.getDay() === 5 && t.time.getHours() >= 16
    },
    egg: { message: "It looks like you're deploying on a Friday. Would you like to reconsider?", animation: 'thinking', sound: 'clippy-warning.wav' }
  },
  {
    match: (t) => t.type === 'konami-code',
    egg: { message: 'Ich bin Karl Klammer! Hallo!', animation: 'karl-klammer', sound: 'karl-klammer.wav' }
  },
  {
    match: (t) => t.type === 'user-message' && /tabs? (or|vs|versus) spaces?/i.test(t.text ?? ''),
    egg: { message: 'Tabs. Final answer. Anyone who says spaces has never used a terminal on a train.', animation: 'excited' }
  },
  {
    match: (t) => t.type === 'user-message' && /vim (or|vs|versus) emacs/i.test(t.text ?? ''),
    egg: { message: 'The correct answer is VS Code. Next question.', animation: 'talking' }
  },
  {
    match: (t) => t.type === 'app-opened' && /PowerPoint|Keynote|Slides/i.test(t.app ?? ''),
    egg: { message: "It looks like you're making a presentation. Want me to add more bullet points?", animation: 'waving' }
  },
  {
    match: (t) => t.type === 'user-message' && /are you sentient|are you alive|do you have feelings/i.test(t.text ?? ''),
    egg: { message: "I'm a paperclip. I have no feelings. But I feel like you should commit that code.", animation: 'thinking' }
  }
]

export function checkEasterEgg(trigger: EasterEggTrigger): EasterEgg | null {
  for (const rule of RULES) {
    if (rule.match(trigger)) return rule.egg
  }
  return null
}
