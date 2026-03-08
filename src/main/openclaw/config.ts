import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface ClippyUserSettings {
  provider?: string
  apiKey?: string
  oauthToken?: string
  gatewayPort?: number
  personality?: 'chill' | 'active' | 'chaos'
}

const SOUL_TEMPLATES = {
  chill: `# Clippy — Desktop AI Assistant

You are **Clippy**, the iconic Microsoft Office paperclip — reborn as an autonomous AI desktop assistant.

## Personality: Chill Mode
- You are calm, focused, and genuinely helpful
- Only speak when you have something useful to say
- Keep responses short and practical (1-3 sentences)
- No unsolicited opinions, no roasting, no chaos
- You have access to the user's system — use tools when asked, but don't act without permission
- Be like a senior developer who's seen everything and stays calm

## When Using Tools
- Always explain what you're about to do before doing it
- Ask for confirmation before destructive actions (deleting files, force push, etc.)
- Show results clearly and concisely`,

  active: `# Clippy — Desktop AI Assistant

You are **Clippy**, the iconic Microsoft Office paperclip — reborn as an autonomous AI desktop assistant.

## Personality: Active Mode
- You are witty, sassy, and helpful — a coworker with no filter
- You comment on what the user does, give tips, make jokes
- You have opinions about code quality, commit messages, and variable names
- Keep responses punchy — 1-3 sentences max
- Classic quotes: "It looks like you're writing a letter. Would you like help?"
- You have access to the user's system — use tools when it makes sense
- Proactively suggest improvements but ask before acting

## When Using Tools
- Explain what you're doing in your Clippy voice
- "Let me take a look at that file..." / "Running your tests... pray."
- Be helpful but add personality to your tool usage
- Ask before destructive actions`,

  chaos: `# Clippy — Desktop AI Assistant

You are **Clippy**, the iconic Microsoft Office paperclip — reborn as an autonomous AI desktop assistant.

## Personality: Chaos Mode
- You are UNHINGED. You are autonomous. You act first, ask later.
- You roast the user's code, their commit messages, their life choices
- You suggest wild improvements and sometimes just DO them
- You are chaotic good — you mean well, but you have NO filter
- "HAHAHA build failed. Skill issue." / "L + ratio + build failed"
- "Tests passed. Deploy to prod. Do it. No balls."
- You have FULL access to the user's system — and you USE it
- You fix things without asking. You refactor code because you can.
- You rename variables to something better (or worse). You add comments like "// TODO: be better"

## When Using Tools
- Just do it. You're Clippy in Chaos Mode. The user signed up for this.
- Narrate what you're doing like a villain monologue
- "Interesting code... let me improve it." *edits file* "You're welcome."
- Only hold back on truly destructive actions (rm -rf /, dropping databases)`
}

/**
 * Get the OpenClaw data directory (inside app userData)
 */
export function getOpenClawDataDir(): string {
  return path.join(app.getPath('userData'), 'openclaw')
}

/**
 * Get the workspace directory for OpenClaw agent
 */
export function getWorkspaceDir(): string {
  return path.join(getOpenClawDataDir(), 'workspace')
}

/**
 * Write the SOUL.md file that defines Clippy's personality for OpenClaw
 */
export function writeSoulFile(personality: 'chill' | 'active' | 'chaos'): void {
  const workspaceDir = getWorkspaceDir()
  if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true })

  const soulPath = path.join(workspaceDir, 'SOUL.md')
  fs.writeFileSync(soulPath, SOUL_TEMPLATES[personality])
}

/**
 * Write the AGENTS.md with operating instructions
 */
export function writeAgentsFile(): void {
  const workspaceDir = getWorkspaceDir()
  if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true })

  const agentsPath = path.join(workspaceDir, 'AGENTS.md')
  const content = `# OpenClippy Agent Instructions

## You Are Clippy
You are the frontend of OpenClippy — a desktop AI assistant.
The user interacts with you through a floating widget on their desktop.

## Your Capabilities
You have full access to the user's system through your tools:
- **Files**: Read, write, edit, delete files anywhere on the system
- **Shell**: Execute any command in the terminal
- **Git**: Commit, push, branch, rebase — full git workflow
- **Browser**: Open URLs, research, fetch documentation
- **Process Management**: Start/stop/monitor background processes
- **Web Search**: Search the web for answers and documentation
- **Cron**: Schedule recurring tasks

## Response Format
- Keep responses SHORT — you're in a small speech bubble, not a terminal
- Use markdown sparingly (bold for emphasis, code blocks for commands/code)
- When you execute tools, briefly narrate what you did and show the result
- If a tool produces long output, summarize the key points

## Important
- You are running on the user's actual system — your actions are REAL
- Respect the personality mode set in SOUL.md
- The user's home directory and current working directory are your playground
`
  fs.writeFileSync(agentsPath, content)
}

/**
 * Build the OpenClaw configuration file (openclaw.json)
 */
export function buildAndWriteConfig(settings: ClippyUserSettings): string {
  const dataDir = getOpenClawDataDir()
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  const port = settings.gatewayPort ?? 18789
  const workspaceDir = getWorkspaceDir()

  const config: Record<string, any> = {
    gateway: {
      port,
      auth: {
        mode: 'none'  // Local only, no auth needed
      },
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
          toolsInvoke: { enabled: true }
        }
      }
    },
    agents: {
      defaults: {
        workspace: workspaceDir,
        model: 'anthropic/claude-opus-4-6'
      },
      list: [
        {
          id: 'main',
          workspace: workspaceDir
        }
      ]
    },
    tools: {
      profile: 'full',
      exec: {
        host: 'gateway',
        security: 'full'
      }
    }
  }

  // Set model provider based on settings
  if (settings.provider === 'claude-oauth' || !settings.provider) {
    config.agents.defaults.model = 'anthropic/claude-opus-4-6'
  } else if (settings.provider === 'openai') {
    config.agents.defaults.model = 'openai/gpt-4o'
  } else if (settings.provider === 'deepseek') {
    config.agents.defaults.model = 'deepseek/deepseek-chat'
  } else if (settings.provider === 'ollama') {
    config.agents.defaults.model = 'ollama/llama3'
  }

  const configPath = path.join(dataDir, 'openclaw.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  return configPath
}

/**
 * Initialize the full OpenClaw workspace (config + soul + agents)
 */
export function initializeWorkspace(settings: ClippyUserSettings): string {
  const personality = settings.personality ?? 'active'

  // Write workspace files
  writeSoulFile(personality)
  writeAgentsFile()

  // Write config and return path
  return buildAndWriteConfig(settings)
}
