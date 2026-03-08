import { desktopCapturer } from 'electron'

export interface WindowContext {
  title: string
  appName: string
  category: string
}

export function buildVisionPrompt(
  windowInfo: WindowContext,
  personality: 'chill' | 'active' | 'chaos'
): string {
  const base = `You are Clippy, a desktop assistant. You can see the user's screen.
Current app: ${windowInfo.appName} (${windowInfo.category})
Window title: ${windowInfo.title}

Analyze this screenshot and respond in character.`

  const personalityAddons: Record<string, string> = {
    chill: 'Only comment if you see something truly helpful or important.',
    active: 'Comment on what you see. Give tips, make jokes, be helpful and a bit sassy.',
    chaos: 'Go wild. Comment on everything. Be brutally honest. Roast them if appropriate. Suggest improvements aggressively. Take initiative.'
  }

  return `${base}\n\nPersonality: ${personalityAddons[personality]}`
}

export async function captureScreen(): Promise<string> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1024, height: 768 }
  })

  if (sources.length === 0) throw new Error('No screen source available')

  const screenshot = sources[0].thumbnail
  const resized = screenshot.resize({ width: 1024 })
  return resized.toDataURL()
}

export async function analyzeScreen(
  screenshotBase64: string,
  windowInfo: WindowContext,
  personality: 'chill' | 'active' | 'chaos',
  sendToVisionAPI: (prompt: string, imageBase64: string) => Promise<string>
): Promise<string> {
  const prompt = buildVisionPrompt(windowInfo, personality)
  return sendToVisionAPI(prompt, screenshotBase64)
}
