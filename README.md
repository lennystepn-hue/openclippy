# OpenClippy

> The iconic Clippy, reborn as an autonomous AI desktop assistant powered by OpenClaw.

**OpenClippy** brings back the legendary Microsoft Office paperclip — but this time, he actually helps. Powered by OpenClaw's agent engine, Clippy lives on your desktop as a floating widget, sees what you're doing, learns your workflows, and has opinions about your code.

## Features

- **Original Retro Sprites** — Authentic Office 97 Clippy animations (43 animation states!)
- **AI-Powered Chat** — Talk to Clippy in the classic speech bubble. He responds via Claude, GPT, DeepSeek, or local LLMs
- **Screen Awareness** — Clippy knows what app you're using and can take screenshots to understand context
- **Workflow Automation** — Detects your daily routines and offers to automate them
- **Personality Modes** — Chill (helpful), Active (sassy), Chaos (unhinged and autonomous)
- **Reactions** — Celebrates test passes, roasts build failures, judges your commits
- **Voice** — Text-to-Speech and Speech-to-Text ("Hey Clippy")
- **Easter Eggs** — Classic Clippy quotes, Konami code, strong opinions on tabs vs spaces
- **Setup Wizard** — Guided setup right in Clippy's speech bubble
- **Cross-Platform** — Linux, macOS, Windows via Electron
- **Open Source** — MIT licensed, powered by OpenClaw

## Installation

### Download

| Platform | Download |
|----------|----------|
| Linux | [AppImage](https://github.com/lennystepn-hue/openclippy/releases/latest) |
| macOS | [DMG](https://github.com/lennystepn-hue/openclippy/releases/latest) |
| Windows | [Installer](https://github.com/lennystepn-hue/openclippy/releases/latest) |

### From Source

```bash
git clone https://github.com/lennystepn-hue/openclippy.git
cd openclippy
npm install
npm run dev
```

## Quick Start

1. Launch OpenClippy
2. Clippy appears and guides you through setup
3. Choose your AI provider (ChatGPT, Claude, local LLM)
4. Pick a personality mode
5. Start chatting or let Clippy watch and learn

## Personality Modes

| Mode | Behavior |
|------|----------|
| **Chill** | Only speaks when something is genuinely useful |
| **Active** | Comments on your work, gives tips, makes jokes |
| **Chaos** | Acts autonomously, roasts your code, deploys on Fridays |

## Tech Stack

- **Electron** — Cross-platform desktop
- **OpenClaw** — Embedded AI agent engine
- **TypeScript** — Type-safe codebase
- **Original Clippy Sprites** — Extracted from Office 97

## Contributing

Contributions welcome! Open an issue or submit a PR.

## License

MIT

## Credits

- [OpenClaw](https://github.com/openclaw/openclaw) — Agent engine
- [clippyjs](https://github.com/pi0/clippyjs) — Original Clippy sprites
- Microsoft — For creating the legend
