#!/usr/bin/env node

/**
 * OpenClippy Doctor — Setup & Diagnostics CLI
 *
 * Usage:
 *   npx openclippy          # Full setup wizard
 *   npx openclippy doctor   # Diagnose issues
 */

import { execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { platform, homedir, arch } from 'os'
import { join } from 'path'
import readline from 'readline'

// ─── Colors (no dependencies) ────────────────────────────────────────────────

const isColorSupported = process.stdout.isTTY && !process.env.NO_COLOR
const c = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  white: isColorSupported ? '\x1b[37m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',
}

// ─── ASCII Clippy ────────────────────────────────────────────────────────────

const CLIPPY_WAVE = `
${c.yellow}    ╭──────────────────────────────────╮
    │                                  │
    │  PLACEHOLDER                     │
    │                                  │
    ╰──────────┬───────────────────────╯
               │
${c.white}         ┌───┴───┐
         │ ◉   ◉ │
         │   ▽   │
         │  ───  │
         └───┬───┘
          ╭──┴──╮
          │     │
         ╱│     │╲
        ╱ └──┬──┘ ╲
             │
            ╱ ╲${c.reset}
`

function clippy(text) {
  const lines = text.split('\n')
  const maxLen = Math.max(...lines.map(l => l.length))
  const padded = lines.map(l => l.padEnd(maxLen))

  const top = `${c.yellow}    ╭${'─'.repeat(maxLen + 4)}╮${c.reset}`
  const bot = `${c.yellow}    ╰──────────┬${'─'.repeat(maxLen - 7)}╯${c.reset}`
  const body = padded.map(l => `${c.yellow}    │${c.reset}  ${l}  ${c.yellow}│${c.reset}`).join('\n')

  const sprite = `
${c.white}         ┌───┴───┐
         │ ${c.cyan}◉   ◉${c.white} │
         │   ${c.yellow}▽${c.white}   │
         │  ${c.green}───${c.white}  │
         └───┬───┘
          ╭──┴──╮
          │     │
         ╱│     │╲
        ╱ └──┬──┘ ╲
             │
            ╱ ╲${c.reset}`

  console.log(`\n${top}\n${body}\n${bot}`)
  console.log(`${c.yellow}               │${c.reset}`)
  console.log(sprite)
  console.log()
}

function step(icon, label) {
  process.stdout.write(`  ${icon}  ${label}`)
}

function pass(detail) {
  console.log(`  ${c.green}✓${c.reset}${detail ? `  ${c.dim}${detail}${c.reset}` : ''}`)
}

function fail(detail) {
  console.log(`  ${c.red}✗${c.reset}${detail ? `  ${detail}` : ''}`)
}

function warn(detail) {
  console.log(`  ${c.yellow}!${c.reset}${detail ? `  ${c.yellow}${detail}${c.reset}` : ''}`)
}

function info(text) {
  console.log(`     ${c.dim}${text}${c.reset}`)
}

function blank() {
  console.log()
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`  ${c.cyan}?${c.reset}  ${question} `, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000, ...opts }).trim()
  } catch {
    return null
  }
}

// ─── Checks ──────────────────────────────────────────────────────────────────

function checkNodeVersion() {
  step('📦', 'Node.js version...')
  const version = exec('node --version')
  if (!version) {
    fail('Node.js not found!')
    info(`Install from: ${c.cyan}https://nodejs.org${c.reset}`)
    info('OpenClippy requires Node.js 22.12 or later.')
    return false
  }

  const match = version.match(/v(\d+)\.(\d+)/)
  if (!match) {
    fail(`Unexpected version format: ${version}`)
    return false
  }

  const [, major, minor] = match.map(Number)
  if (major > 22 || (major === 22 && minor >= 12)) {
    pass(version)
    return true
  } else {
    fail(`${version} — need v22.12+`)
    info(`Update: ${c.cyan}https://nodejs.org${c.reset}`)
    return false
  }
}

function checkOpenClaw() {
  step('🦞', 'OpenClaw installation...')
  const isWin = platform() === 'win32'
  const which = exec(isWin ? 'where openclaw' : 'which openclaw')

  if (!which) {
    fail('not found')
    return { installed: false, path: null }
  }

  // On Windows, prefer .cmd variant
  const lines = which.split(/\r?\n/).filter(Boolean)
  const bin = (isWin ? lines.find(l => l.endsWith('.cmd')) : null) || lines[0]

  const version = exec(`"${bin}" --version`) || 'unknown'
  pass(`${version} ${c.dim}(${bin})${c.reset}`)
  return { installed: true, path: bin, version }
}

function checkOpenClawConfig() {
  step('⚙️ ', 'OpenClaw config...')
  const configDir = join(homedir(), '.openclaw')
  const configFile = join(configDir, 'openclaw.json')

  if (existsSync(configFile)) {
    pass(configFile)
    return true
  } else if (existsSync(configDir)) {
    warn('directory exists but no config — run: openclaw onboard')
    return false
  } else {
    fail('not configured — run: openclaw onboard')
    return false
  }
}

async function checkGateway() {
  step('🚀', 'OpenClaw Gateway...')

  return new Promise(resolve => {
    const isWin = platform() === 'win32'
    const proc = spawn(
      isWin ? 'openclaw.cmd' : 'openclaw',
      ['gateway', '--port', '19789', '--auth', 'none', '--bind', 'loopback', '--allow-unconfigured'],
      { stdio: ['pipe', 'pipe', 'pipe'], shell: isWin }
    )

    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        proc.kill()
        fail('startup timeout (15s)')
        resolve(false)
      }
    }, 15000)

    const checkOutput = (data) => {
      const msg = data.toString()
      if (!resolved && msg.includes('listening on')) {
        resolved = true
        clearTimeout(timeout)
        proc.kill()
        pass('starts and listens on port 19789')
        resolve(true)
      }
    }

    proc.stdout?.on('data', checkOutput)
    proc.stderr?.on('data', checkOutput)

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        fail(`spawn error: ${err.message}`)
        resolve(false)
      }
    })

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        if (code === 0) {
          warn('exited cleanly but no ready signal')
        } else {
          fail(`exited with code ${code}`)
        }
        resolve(false)
      }
    })
  })
}

function checkPlatformBinaries() {
  step('💻', 'Platform...')
  const p = platform()
  const a = arch()
  const supported = ['win32', 'darwin', 'linux'].includes(p)
  if (supported) {
    const names = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }
    pass(`${names[p]} (${a})`)
  } else {
    warn(`${p} (${a}) — may not be supported`)
  }
  return supported
}

function checkDesktopApp() {
  step('📎', 'OpenClippy app...')
  const isWin = platform() === 'win32'
  const isMac = platform() === 'darwin'

  let found = false
  if (isWin) {
    const paths = [
      join(homedir(), 'AppData', 'Local', 'Programs', 'openclippy', 'OpenClippy.exe'),
      join(homedir(), 'AppData', 'Local', 'openclippy', 'OpenClippy.exe'),
    ]
    found = paths.some(p => existsSync(p))
  } else if (isMac) {
    found = existsSync('/Applications/OpenClippy.app')
  } else {
    // Linux — check common paths
    const paths = [
      '/usr/bin/openclippy',
      '/usr/local/bin/openclippy',
      join(homedir(), 'Applications', 'OpenClippy.AppImage'),
      join(homedir(), '.local', 'bin', 'openclippy'),
    ]
    found = paths.some(p => existsSync(p))
  }

  if (found) {
    pass('installed')
  } else {
    warn('not found — download from: https://github.com/lennystepn-hue/openclippy/releases/latest')
  }
  return found
}

// ─── Install Flow ────────────────────────────────────────────────────────────

async function installOpenClaw() {
  console.log(`\n  ${c.bold}Installing OpenClaw...${c.reset}\n`)

  return new Promise((resolve) => {
    const proc = spawn('npm', ['install', '-g', 'openclaw'], {
      stdio: 'inherit',
      shell: true
    })
    proc.on('exit', (code) => {
      blank()
      if (code === 0) {
        console.log(`  ${c.green}✓${c.reset}  OpenClaw installed successfully!`)
        resolve(true)
      } else {
        console.log(`  ${c.red}✗${c.reset}  Installation failed (exit code ${code})`)
        info('Try running manually: npm install -g openclaw')
        resolve(false)
      }
    })
    proc.on('error', () => {
      console.log(`  ${c.red}✗${c.reset}  Failed to run npm`)
      resolve(false)
    })
  })
}

async function runOnboard() {
  console.log(`\n  ${c.bold}Starting OpenClaw setup...${c.reset}\n`)

  return new Promise((resolve) => {
    const proc = spawn('openclaw', ['onboard'], {
      stdio: 'inherit',
      shell: true
    })
    proc.on('exit', (code) => {
      blank()
      resolve(code === 0)
    })
    proc.on('error', () => {
      console.log(`  ${c.red}✗${c.reset}  Failed to run openclaw onboard`)
      resolve(false)
    })
  })
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function doctor() {
  clippy(
    "It looks like you're having trouble.\nDon't worry, I've been debugging\nsince 1997. Let me take a look..."
  )

  console.log(`  ${c.bold}${c.white}─── OpenClippy Doctor ───${c.reset}\n`)

  const nodeOk = checkNodeVersion()
  blank()

  const claw = checkOpenClaw()
  blank()

  if (claw.installed) {
    checkOpenClawConfig()
    blank()
    await checkGateway()
    blank()
  }

  checkPlatformBinaries()
  blank()

  checkDesktopApp()
  blank()

  // Summary
  console.log(`  ${c.bold}${c.white}─── Summary ───${c.reset}\n`)

  if (nodeOk && claw.installed) {
    console.log(`  ${c.green}${c.bold}Everything looks good!${c.reset}`)
    info("If Clippy still won't connect, restart the app.")
    info('Still broken? Open an issue: https://github.com/lennystepn-hue/openclippy/issues')
  } else if (!nodeOk) {
    console.log(`  ${c.red}${c.bold}Node.js 22.12+ is required.${c.reset}`)
    info('Download: https://nodejs.org')
  } else {
    console.log(`  ${c.red}${c.bold}OpenClaw is not installed.${c.reset}`)
    info('Run: npm install -g openclaw')
  }
  blank()
}

async function setup() {
  clippy(
    "It looks like you're setting up\na desktop assistant. Finally,\nsomeone who needs me. Let's go!"
  )

  console.log(`  ${c.bold}${c.white}─── OpenClippy Setup ───${c.reset}\n`)

  // Step 1: Node.js
  const nodeOk = checkNodeVersion()
  blank()
  if (!nodeOk) {
    console.log(`\n  ${c.red}${c.bold}Please install Node.js 22.12+ first:${c.reset}`)
    console.log(`  ${c.cyan}https://nodejs.org${c.reset}\n`)
    console.log(`  Then run this again. I'll wait. I've been waiting since 1997.\n`)
    process.exit(1)
  }

  // Step 2: OpenClaw
  let claw = checkOpenClaw()
  blank()
  if (!claw.installed) {
    clippy(
      "No brain found. That explains a lot.\nLet me install OpenClaw for you.\nThis is the AI that powers me."
    )

    const answer = await ask('Install OpenClaw globally? (Y/n)')
    if (answer.toLowerCase() === 'n') {
      console.log(`\n  Okay. Run ${c.cyan}npm install -g openclaw${c.reset} whenever you're ready.`)
      console.log(`  I'll just be here. Alone. Again.\n`)
      process.exit(0)
    }

    const installed = await installOpenClaw()
    if (!installed) {
      process.exit(1)
    }
    claw = checkOpenClaw()
    blank()
  }

  // Step 3: OpenClaw config
  const hasConfig = checkOpenClawConfig()
  blank()
  if (!hasConfig) {
    clippy(
      "OpenClaw needs to know which AI\nmodel to use. Don't worry, the\nwizard is friendlier than I am."
    )

    const answer = await ask('Run OpenClaw setup wizard? (Y/n)')
    if (answer.toLowerCase() !== 'n') {
      await runOnboard()
    }
  }

  // Step 4: Gateway test
  clippy(
    "Almost done. Let me check if the\ngateway starts. This is the part\nwhere I talk to my brain."
  )

  const gatewayOk = await checkGateway()
  blank()

  // Step 5: Platform & app
  checkPlatformBinaries()
  blank()
  const appInstalled = checkDesktopApp()
  blank()

  // Summary
  console.log(`  ${c.bold}${c.white}─── Setup Complete ───${c.reset}\n`)

  if (gatewayOk) {
    clippy(
      "We're good! Everything works.\nStart the app and I'll be right\nthere on your desktop. Miss me?"
    )

    if (!appInstalled) {
      console.log(`  ${c.yellow}Download the app:${c.reset}`)
      console.log(`  ${c.cyan}https://github.com/lennystepn-hue/openclippy/releases/latest${c.reset}\n`)
    }
  } else {
    clippy(
      "Gateway didn't start. That's not\ngreat. Run me with 'doctor' to\ndig deeper. I love digging."
    )
    console.log(`  Run: ${c.cyan}npx openclippy doctor${c.reset}\n`)
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const command = process.argv[2]

console.log()
console.log(`  ${c.bold}${c.yellow}📎 OpenClippy${c.reset} ${c.dim}v0.5.0${c.reset}`)
console.log(`  ${c.dim}The paperclip that never left.${c.reset}`)
console.log()

if (command === 'doctor') {
  doctor().catch(console.error)
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log(`  ${c.bold}Usage:${c.reset}`)
  console.log(`    npx openclippy          ${c.dim}Full setup wizard${c.reset}`)
  console.log(`    npx openclippy doctor   ${c.dim}Diagnose issues${c.reset}`)
  console.log(`    npx openclippy help     ${c.dim}This message${c.reset}`)
  console.log()
} else {
  setup().catch(console.error)
}
