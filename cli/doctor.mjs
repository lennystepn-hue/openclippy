#!/usr/bin/env node

/**
 * OpenClippy Doctor — Setup & Diagnostics CLI
 *
 * Usage:
 *   npx openclippy          # Full setup wizard
 *   npx openclippy doctor   # Diagnose issues
 */

import { execSync, spawn, execFile } from 'child_process'
import { existsSync, createWriteStream, mkdirSync, chmodSync, renameSync, readFileSync, writeFileSync } from 'fs'
import { platform, homedir, arch, tmpdir } from 'os'
import { join, basename } from 'path'
import { get as httpsGet } from 'https'
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

// Clippy is a paperclip, not a robot!

function clippy(text) {
  const lines = text.split('\n')
  const maxLen = Math.max(...lines.map(l => l.length))
  const padded = lines.map(l => l.padEnd(maxLen))

  const top = `${c.yellow}    ╭${'─'.repeat(maxLen + 4)}╮${c.reset}`
  const bot = `${c.yellow}    ╰──────────┬${'─'.repeat(maxLen - 7)}╯${c.reset}`
  const body = padded.map(l => `${c.yellow}    │${c.reset}  ${l}  ${c.yellow}│${c.reset}`).join('\n')

  const sprite = `
${c.yellow}            ╭───╮
            │   │
         ╭──╯   ╰──╮
         │  ${c.cyan}◉   ◉${c.yellow}  │
         │    ${c.white}▽${c.yellow}    │
         ╰────┬────╯
              │
              │
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

  if (!existsSync(configFile)) {
    if (existsSync(configDir)) {
      warn('directory exists but no config — run: openclaw onboard')
    } else {
      fail('not configured — run: openclaw onboard')
    }
    return false
  }

  pass(configFile)
  ensureChatCompletionsEnabled(configFile)
  return true
}

/**
 * OpenClippy needs gateway.http.endpoints.chatCompletions.enabled = true
 * in the global OpenClaw config. This is disabled by default.
 */
function ensureChatCompletionsEnabled(configFile) {
  try {
    const raw = readFileSync(configFile, 'utf-8')
    const config = JSON.parse(raw)

    if (config?.gateway?.http?.endpoints?.chatCompletions?.enabled === true) {
      pass('chatCompletions HTTP endpoint: enabled')
      return
    }

    info(`${c.yellow}Enabling chatCompletions HTTP endpoint (required for OpenClippy)...${c.reset}`)
    if (!config.gateway) config.gateway = {}
    if (!config.gateway.http) config.gateway.http = {}
    if (!config.gateway.http.endpoints) config.gateway.http.endpoints = {}
    if (!config.gateway.http.endpoints.chatCompletions) config.gateway.http.endpoints.chatCompletions = {}
    config.gateway.http.endpoints.chatCompletions.enabled = true
    writeFileSync(configFile, JSON.stringify(config, null, 2))
    pass('chatCompletions HTTP endpoint: now enabled')
  } catch (err) {
    warn(`could not verify chatCompletions: ${err.message}`)
  }
}

async function checkGateway() {
  step('🚀', 'OpenClaw Gateway...')

  // Use port 19787 for doctor tests to avoid conflict with a running app (19789)
  const testPort = 19787

  return new Promise(resolve => {
    const isWin = platform() === 'win32'
    const proc = spawn(
      isWin ? 'openclaw.cmd' : 'openclaw',
      ['gateway', '--port', String(testPort), '--auth', 'none', '--bind', 'loopback', '--allow-unconfigured'],
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

    const checkOutput = async (data) => {
      const msg = data.toString()
      if (!resolved && msg.includes('listening on')) {
        // Gateway claims to be listening — now test the actual HTTP API
        pass(`starts and listens on port ${testPort}`)

        try {
          const http = await import('http')
          const body = JSON.stringify({
            model: 'openclaw',
            messages: [{ role: 'user', content: 'ping' }],
            stream: false
          })

          const apiResult = await new Promise((res, rej) => {
            const req = http.request({
              hostname: '127.0.0.1',
              port: testPort,
              path: '/v1/chat/completions',
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
              timeout: 10000
            }, (resp) => {
              let data = ''
              resp.on('data', chunk => data += chunk)
              resp.on('end', () => res({ status: resp.statusCode, body: data }))
            })
            req.on('error', rej)
            req.on('timeout', () => { req.destroy(); rej(new Error('timeout')) })
            req.write(body)
            req.end()
          })

          if (apiResult.status >= 200 && apiResult.status < 300) {
            pass(`HTTP API responds (${apiResult.status})`)
          } else {
            fail(`HTTP API returned ${apiResult.status}: ${apiResult.body?.slice(0, 200)}`)
          }
        } catch (err) {
          fail(`HTTP API test failed: ${err.message}`)
        }

        resolved = true
        clearTimeout(timeout)
        proc.kill()
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

// ─── Download & Install ──────────────────────────────────────────────────────

const GITHUB_REPO = 'lennystepn-hue/openclippy'

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    httpsGet(url, { headers: { 'User-Agent': 'openclippy-cli' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGetJson(res.headers.location).then(resolve, reject)
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Failed to parse JSON')) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      httpsGet(url, { headers: { 'User-Agent': 'openclippy-cli' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location)
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0
        const file = createWriteStream(dest)

        res.on('data', (chunk) => {
          downloaded += chunk.length
          file.write(chunk)
          if (totalBytes > 0) {
            const pct = Math.round((downloaded / totalBytes) * 100)
            const bar = '█'.repeat(Math.round(pct / 4)) + '░'.repeat(25 - Math.round(pct / 4))
            process.stdout.write(`\r     ${c.dim}[${bar}] ${pct}%${c.reset}`)
          }
        })

        res.on('end', () => {
          file.end()
          if (totalBytes > 0) process.stdout.write('\n')
          resolve()
        })

        res.on('error', (err) => { file.destroy(); reject(err) })
      }).on('error', reject)
    }
    follow(url)
  })
}

async function getLatestRelease() {
  try {
    return await httpsGetJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
  } catch {
    return null
  }
}

function getAssetPattern() {
  const p = platform()
  const a = arch()

  if (p === 'win32') {
    return { pattern: /\.exe$/i, ext: '.exe', name: 'Windows installer' }
  } else if (p === 'darwin') {
    const archPart = a === 'arm64' ? 'arm64' : 'x64'
    return { pattern: new RegExp(`${archPart}.*\\.dmg$`, 'i'), ext: '.dmg', name: 'macOS installer', fallbackPattern: /\.dmg$/i }
  } else {
    return { pattern: /\.AppImage$/i, ext: '.AppImage', name: 'Linux AppImage' }
  }
}

function findAppAsset(assets) {
  const { pattern, fallbackPattern } = getAssetPattern()
  let asset = assets.find(a => pattern.test(a.name))
  if (!asset && fallbackPattern) {
    asset = assets.find(a => fallbackPattern.test(a.name))
  }
  return asset
}

async function downloadAndInstall() {
  step('📥', 'Fetching latest release...')
  const release = await getLatestRelease()
  if (!release) {
    fail('Could not reach GitHub')
    info(`Download manually: ${c.cyan}https://github.com/${GITHUB_REPO}/releases/latest${c.reset}`)
    return false
  }
  pass(release.tag_name)
  blank()

  const asset = findAppAsset(release.assets || [])
  if (!asset) {
    fail('No installer found for your platform')
    info(`Download manually: ${c.cyan}https://github.com/${GITHUB_REPO}/releases/tag/${release.tag_name}${c.reset}`)
    return false
  }

  const { name: platformName } = getAssetPattern()
  step('⬇️ ', `Downloading ${platformName} (${asset.name})...`)
  console.log()

  const downloadDir = join(tmpdir(), 'openclippy-setup')
  mkdirSync(downloadDir, { recursive: true })
  const downloadPath = join(downloadDir, asset.name)

  try {
    await downloadFile(asset.browser_download_url, downloadPath)
    console.log(`  ${c.green}✓${c.reset}  Downloaded to ${c.dim}${downloadPath}${c.reset}`)
  } catch (err) {
    fail(`Download failed: ${err.message}`)
    return false
  }
  blank()

  // Platform-specific install
  const p = platform()

  if (p === 'win32') {
    step('🔧', 'Running installer...')
    console.log()
    info('The installer window will open. Follow the prompts.')
    blank()

    // Use 'start' command on Windows — avoids EBUSY from antivirus file locks
    try {
      execSync(`start "" "${downloadPath}"`, { shell: true, timeout: 10000 })
      console.log(`  ${c.green}✓${c.reset}  Installer launched!`)
      info('OpenClippy will start automatically after installation.')
      return true
    } catch {
      // Fallback: just tell the user where the file is
      console.log(`  ${c.yellow}!${c.reset}  Could not launch installer automatically.`)
      info(`Run it manually: ${c.cyan}${downloadPath}${c.reset}`)
      return true
    }

  } else if (p === 'darwin') {
    step('🔧', 'Opening installer...')
    console.log()
    try {
      execSync(`open "${downloadPath}"`, { timeout: 10000 })
      console.log(`  ${c.green}✓${c.reset}  DMG opened — drag OpenClippy to Applications`)
      return true
    } catch {
      fail('Could not open DMG')
      info(`Open manually: ${downloadPath}`)
      return false
    }

  } else {
    // Linux AppImage
    step('🔧', 'Setting up AppImage...')
    console.log()

    const appDir = join(homedir(), 'Applications')
    mkdirSync(appDir, { recursive: true })
    const finalPath = join(appDir, 'OpenClippy.AppImage')

    try {
      renameSync(downloadPath, finalPath)
      chmodSync(finalPath, 0o755)
      console.log(`  ${c.green}✓${c.reset}  Installed to ${c.dim}${finalPath}${c.reset}`)
      return finalPath
    } catch {
      // rename across filesystems doesn't work, copy instead
      try {
        execSync(`cp "${downloadPath}" "${finalPath}" && chmod +x "${finalPath}"`)
        console.log(`  ${c.green}✓${c.reset}  Installed to ${c.dim}${finalPath}${c.reset}`)
        return finalPath
      } catch {
        chmodSync(downloadPath, 0o755)
        console.log(`  ${c.green}✓${c.reset}  Ready at ${c.dim}${downloadPath}${c.reset}`)
        return downloadPath
      }
    }
  }
}

function launchApp(appPath) {
  const p = platform()

  try {
    if (p === 'win32') {
      // Windows — installer handles launch, or find the exe
      const paths = [
        join(homedir(), 'AppData', 'Local', 'Programs', 'openclippy', 'OpenClippy.exe'),
        join(homedir(), 'AppData', 'Local', 'openclippy', 'OpenClippy.exe'),
      ]
      const exe = paths.find(p => existsSync(p))
      if (exe) {
        spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
        return true
      }
      return false // installer will handle it
    } else if (p === 'darwin') {
      execSync('open -a OpenClippy', { timeout: 5000 })
      return true
    } else if (appPath) {
      spawn(appPath, ['--no-sandbox'], { detached: true, stdio: 'ignore' }).unref()
      return true
    }
  } catch {
    return false
  }
  return false
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
  let appInstalled = checkDesktopApp()
  blank()

  // Step 6: Download & install app if needed
  let appPath = null
  if (!appInstalled && gatewayOk) {
    clippy(
      "Backend is ready but you don't\nhave the app yet. Let me grab\nit from GitHub. One sec..."
    )

    const answer = await ask('Download and install OpenClippy? (Y/n)')
    if (answer.toLowerCase() !== 'n') {
      blank()
      const result = await downloadAndInstall()
      blank()
      if (result) {
        appInstalled = true
        if (typeof result === 'string') appPath = result
      }
    }
  }

  // Summary
  console.log(`  ${c.bold}${c.white}─── Setup Complete ───${c.reset}\n`)

  if (gatewayOk && appInstalled) {
    clippy(
      "Everything is ready! Starting\nClippy now. See you on your\ndesktop. Try not to scream."
    )

    // Try to launch the app
    const launched = launchApp(appPath)
    if (launched) {
      console.log(`  ${c.green}${c.bold}OpenClippy is starting!${c.reset}`)
      info("I'll appear on your desktop in a moment.")
    } else {
      console.log(`  ${c.green}${c.bold}All set!${c.reset}`)
      info('Launch OpenClippy from your applications to get started.')
    }
  } else if (gatewayOk && !appInstalled) {
    clippy(
      "Backend works but no app yet.\nDownload it and I'll be right\nthere. I promise I won't judge.\n...much."
    )
    console.log(`  ${c.yellow}Download:${c.reset} ${c.cyan}https://github.com/${GITHUB_REPO}/releases/latest${c.reset}`)
  } else {
    clippy(
      "Gateway didn't start. That's not\ngreat. Run me with 'doctor' to\ndig deeper. I love digging."
    )
    console.log(`  Run: ${c.cyan}npx openclippy doctor${c.reset}`)
  }
  blank()
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const command = process.argv[2]

console.log()
console.log(`  ${c.bold}${c.yellow}📎 OpenClippy${c.reset} ${c.dim}v0.5.3${c.reset}`)
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
