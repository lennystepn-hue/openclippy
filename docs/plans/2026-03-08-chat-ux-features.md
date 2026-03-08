# Chat UX Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 essential chat UX features to OpenClippy: text copying, clickable links, screenshot capture, image display, and persistent chat history.

**Architecture:** Incremental additions to the existing chat system. All features integrate into `chat.ts`, `clippy.ts`, `formatResponse()`, CSS, and Electron IPC. No new frameworks.

**Tech Stack:** Electron (desktopCapturer, shell, clipboard, Menu), vanilla TypeScript, JSON file storage in userData.

---

## Task 1: Enable Text Selection + Copy Button on Code Blocks

**Files:**
- Modify: `src/renderer/styles.css:6` (change `user-select: none` to allow selection in bubble)
- Modify: `src/renderer/chat.ts:67-74` (add copy button to code blocks in `formatResponse()`)
- Modify: `src/renderer/styles.css` (add copy button styles)

**Step 1: Enable text selection in speech bubble**

In `src/renderer/styles.css`, change line 6:

```css
/* BEFORE */
html, body {
  background: transparent;
  overflow: hidden;
  user-select: none;
  width: 100%;
  height: 100%;
}

/* AFTER */
html, body {
  background: transparent;
  overflow: hidden;
  user-select: none;
  width: 100%;
  height: 100%;
}

.bubble-content {
  user-select: text;
  cursor: text;
}

.bubble-content .chat-user {
  user-select: text;
}
```

**Step 2: Add copy button to code blocks in formatResponse()**

In `src/renderer/chat.ts`, replace the `formatResponse()` function:

```typescript
let codeBlockCounter = 0

function formatResponse(text: string): string {
  codeBlockCounter = 0
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      const id = `code-block-${++codeBlockCounter}`
      return `<div class="code-block-wrapper"><pre><code id="${id}">${escapeHtml(code)}</code></pre><button class="code-copy-btn" data-target="${id}" title="Copy">&#x2398;</button></div>`
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}
```

**Step 3: Add click handler for copy buttons**

In `src/renderer/chat.ts`, inside `initChat()`, after the `input` event listener (after line 16), add:

```typescript
// Copy button click handler (delegated)
const bubble = document.querySelector('.bubble-content')
bubble?.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('code-copy-btn')) {
    const codeId = target.getAttribute('data-target')
    const codeEl = document.getElementById(codeId!)
    if (codeEl) {
      navigator.clipboard.writeText(codeEl.textContent || '')
      target.textContent = '✓'
      setTimeout(() => { target.innerHTML = '&#x2398;' }, 1500)
    }
  }
})
```

**Step 4: Add CSS for code copy button**

Append to `src/renderer/styles.css`:

```css
/* Code block with copy button */
.code-block-wrapper {
  position: relative;
  margin: 6px 0;
}

.code-copy-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #333;
  color: #ccc;
  border: 1px solid #555;
  border-radius: 3px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.15s;
}

.code-block-wrapper:hover .code-copy-btn {
  opacity: 1;
}

.code-copy-btn:hover {
  background: #555;
  color: #fff;
}
```

**Step 5: Build and verify**

Run: `npx electron-vite build`
Expected: Build succeeds with 0 errors.

**Step 6: Commit**

```bash
git add src/renderer/styles.css src/renderer/chat.ts
git commit -m "feat: enable text selection and code block copy buttons in chat"
```

---

## Task 2: Clickable Links

**Files:**
- Modify: `src/renderer/chat.ts:67-74` (add URL detection to `formatResponse()`)
- Modify: `src/renderer/chat.ts:3-16` (add link click handler in `initChat()`)
- Modify: `src/preload/index.ts` (add `openExternal` IPC bridge)
- Modify: `src/main/ipc.ts` (add `shell:openExternal` handler)
- Modify: `src/renderer/types.d.ts` (add type)
- Modify: `src/renderer/styles.css` (add link styles)

**Step 1: Add URL detection to formatResponse()**

In `src/renderer/chat.ts`, update `formatResponse()`. The URL regex must run AFTER code block replacement but BEFORE newline replacement. Add this line after the inline code replacement:

```typescript
function formatResponse(text: string): string {
  codeBlockCounter = 0
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      const id = `code-block-${++codeBlockCounter}`
      return `<div class="code-block-wrapper"><pre><code id="${id}">${escapeHtml(code)}</code></pre><button class="code-copy-btn" data-target="${id}" title="Copy">&#x2398;</button></div>`
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Clickable links — match URLs not already inside HTML tags
    .replace(/(?<![="'])(https?:\/\/[^\s<)]+)/g, '<a class="chat-link" href="$1">$1</a>')
    .replace(/\n/g, '<br>')
}
```

**Step 2: Add link click handler in initChat()**

In `src/renderer/chat.ts`, extend the existing bubble click handler (from Task 1) to also handle links:

```typescript
bubble?.addEventListener('click', (e) => {
  const target = e.target as HTMLElement

  // Copy button
  if (target.classList.contains('code-copy-btn')) {
    const codeId = target.getAttribute('data-target')
    const codeEl = document.getElementById(codeId!)
    if (codeEl) {
      navigator.clipboard.writeText(codeEl.textContent || '')
      target.textContent = '✓'
      setTimeout(() => { target.innerHTML = '&#x2398;' }, 1500)
    }
    return
  }

  // Clickable links — open in default browser
  if (target.tagName === 'A' && target.classList.contains('chat-link')) {
    e.preventDefault()
    const url = (target as HTMLAnchorElement).href
    window.clippy.openExternal(url)
  }
})
```

**Step 3: Add openExternal to preload**

In `src/preload/index.ts`, add inside the `contextBridge.exposeInMainWorld('clippy', {` object:

```typescript
  // Links
  openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
```

**Step 4: Add openExternal handler in main IPC**

In `src/main/ipc.ts`, add at the top:

```typescript
import { ipcMain, BrowserWindow, app, shell } from 'electron'
```

Then inside `setupIPC()`, add:

```typescript
  // Open URLs in default browser (only allow http/https)
  ipcMain.on('shell:openExternal', (_event, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      shell.openExternal(url)
    }
  })
```

**Step 5: Add type declaration**

In `src/renderer/types.d.ts`, add inside the `clippy` interface:

```typescript
      // Links
      openExternal: (url: string) => void
```

**Step 6: Add link CSS**

Append to `src/renderer/styles.css`:

```css
/* Chat links */
.chat-link {
  color: #1976d2;
  text-decoration: underline;
  cursor: pointer;
  word-break: break-all;
}

.chat-link:hover {
  color: #1565c0;
}
```

**Step 7: Build and verify**

Run: `npx electron-vite build`
Expected: Build succeeds.

**Step 8: Commit**

```bash
git add src/renderer/chat.ts src/preload/index.ts src/main/ipc.ts src/renderer/types.d.ts src/renderer/styles.css
git commit -m "feat: clickable links in chat messages open in default browser"
```

---

## Task 3: Screenshot Capture (Fullscreen)

**Files:**
- Modify: `src/renderer/clippy.ts:76-88` (add screenshot button to bubble)
- Modify: `src/renderer/chat.ts` (add screenshot button handler + display)
- Modify: `src/preload/index.ts` (add screenshot IPC bridge)
- Modify: `src/main/ipc.ts` (add screenshot handler using desktopCapturer)
- Modify: `src/main/openclaw/http-client.ts` (support image content in messages)
- Modify: `src/renderer/types.d.ts` (add types)
- Modify: `src/renderer/styles.css` (add screenshot button + image styles)

**Step 1: Add screenshot button to bubble input area**

In `src/renderer/clippy.ts`, change the `createBubbleElement()` method. Replace the `bubble-input-area` HTML:

```typescript
private createBubbleElement(): HTMLElement {
  const el = document.createElement('div')
  el.id = 'clippy-bubble'
  el.className = 'clippy-bubble hidden'
  el.innerHTML = `
    <div class="bubble-content"></div>
    <div class="bubble-input-area hidden">
      <div class="bubble-input-row">
        <input type="text" class="bubble-input" placeholder="Ask Clippy..." />
        <button class="bubble-screenshot-btn" title="Take screenshot">&#x1F4F7;</button>
      </div>
    </div>
    <div class="bubble-actions"></div>
  `
  return el
}
```

**Step 2: Add screenshot IPC to preload**

In `src/preload/index.ts`, add inside the `clippy` object:

```typescript
  // Screenshot
  captureScreen: () => ipcRenderer.invoke('screenshot:capture'),
```

**Step 3: Add type declaration**

In `src/renderer/types.d.ts`, add:

```typescript
      // Screenshot
      captureScreen: () => Promise<string | null>
```

**Step 4: Add screenshot handler in main IPC**

In `src/main/ipc.ts`, add at the top import:

```typescript
import { ipcMain, BrowserWindow, app, shell, desktopCapturer } from 'electron'
```

Then inside `setupIPC()`, add:

```typescript
  // Screenshot capture — returns base64 PNG
  ipcMain.handle('screenshot:capture', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      })
      if (sources.length === 0) return null
      const screenshot = sources[0].thumbnail.toPNG()
      return `data:image/png;base64,${screenshot.toString('base64')}`
    } catch (err) {
      console.error('Screenshot capture failed:', err)
      return null
    }
  })
```

**Step 5: Add screenshot button handler in chat.ts**

In `src/renderer/chat.ts`, inside `initChat()`, add:

```typescript
  // Screenshot button
  const screenshotBtn = document.querySelector('.bubble-screenshot-btn')
  screenshotBtn?.addEventListener('click', async () => {
    screenshotBtn.textContent = '...'

    const dataUrl = await window.clippy.captureScreen()
    if (!dataUrl) {
      screenshotBtn.textContent = '📷'
      return
    }

    // Show screenshot preview as user message
    const userText = input.value.trim() || 'What do you see on my screen?'
    input.value = ''

    widget.speak(
      `<div class="chat-user">${escapeHtml(userText)}<br><img class="chat-image" src="${dataUrl}" /></div>` +
      `<div class="chat-thinking">Analyzing screenshot...</div>`
    )
    widget.setState('thinking')

    // Send to OpenClaw with image content
    window.clippy.sendMessageWithImage(userText, dataUrl)
    screenshotBtn.textContent = '📷'
  })
```

**Step 6: Add sendMessageWithImage to preload**

In `src/preload/index.ts`, add:

```typescript
  sendMessageWithImage: (text: string, imageDataUrl: string) =>
    ipcRenderer.send('chat:sendWithImage', text, imageDataUrl),
```

**Step 7: Add type to types.d.ts**

In `src/renderer/types.d.ts`, add:

```typescript
      sendMessageWithImage: (text: string, imageDataUrl: string) => void
```

**Step 8: Handle image message in main IPC**

In `src/main/ipc.ts`, inside `setupIPC()`, add:

```typescript
  // Chat with image (screenshot)
  ipcMain.on('chat:sendWithImage', (_event, text: string, imageDataUrl: string) => {
    chatClient.sendWithImage(text, imageDataUrl)
  })
```

**Step 9: Add sendWithImage to http-client.ts**

In `src/main/openclaw/http-client.ts`, add a new method after `send()`:

```typescript
  async sendWithImage(text: string, imageDataUrl: string): Promise<void> {
    if (!this.gatewayReady) {
      this.emit('message', {
        type: 'response',
        content: 'OpenClaw Gateway is not running.',
        done: true
      } as StreamMessage)
      return
    }

    // Build multimodal content block
    const userContent = [
      { type: 'image_url', image_url: { url: imageDataUrl } },
      { type: 'text', text }
    ]

    const messages: any[] = []
    messages.push(...this.history)
    messages.push({ role: 'user', content: userContent })

    this.history.push({ role: 'user', content: text + ' [with screenshot]' })

    this.abortController = new AbortController()

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openclaw-agent-id': this.agentId,
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify({
          model: 'openclaw',
          messages,
          stream: true
        }),
        signal: this.abortController.signal
      })

      // Reuse the same SSE parsing logic from send()
      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        this.emit('message', {
          type: 'response',
          content: `Error: ${response.status} — ${errText}`,
          done: true
        } as StreamMessage)
        return
      }

      if (!response.body) {
        this.emit('message', {
          type: 'response',
          content: 'Error: No response body',
          done: true
        } as StreamMessage)
        return
      }

      await this.parseSSEStream(response.body)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.emit('message', {
          type: 'response',
          content: `Connection error: ${err.message}`,
          done: true
        } as StreamMessage)
      }
    }
  }
```

**Step 10: Extract SSE parsing into reusable method**

In `src/main/openclaw/http-client.ts`, extract the SSE parsing from `send()` into a private method so both `send()` and `sendWithImage()` can use it:

```typescript
  private async parseSSEStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          if (fullContent) {
            this.addToHistory('assistant', fullContent)
          }
          this.emit('message', {
            type: 'response',
            content: fullContent,
            done: true
          } as StreamMessage)
          return
        }

        try {
          const parsed = JSON.parse(data)
          const choice = parsed.choices?.[0]

          if (!choice) continue

          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (tc.function?.name) {
                this.emit('message', {
                  type: 'tool-start',
                  content: tc.function.name,
                  toolName: tc.function.name,
                  done: false
                } as StreamMessage)
              }
            }
          }

          const delta = choice.delta?.content
          if (delta) {
            fullContent += delta
            this.emit('message', {
              type: 'chunk',
              content: delta,
              done: false
            } as StreamMessage)
          }

          if (choice.finish_reason === 'tool_calls') {
            this.emit('message', {
              type: 'tool-result',
              content: 'Executing...',
              done: false
            } as StreamMessage)
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    if (fullContent) {
      this.addToHistory('assistant', fullContent)
      this.emit('message', {
        type: 'response',
        content: fullContent,
        done: true
      } as StreamMessage)
    }
  }
```

Then simplify `send()` to use `await this.parseSSEStream(response.body)` instead of the inline SSE parsing.

**Step 11: Add CSS for screenshot button and images**

Append to `src/renderer/styles.css`:

```css
/* Input row with screenshot button */
.bubble-input-row {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 8px;
}

.bubble-input-row .bubble-input {
  flex: 1;
  margin-top: 0;
}

.bubble-screenshot-btn {
  background: #e0e0e0;
  border: 1px solid #999;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.bubble-screenshot-btn:hover {
  background: #d0d0d0;
}

/* Chat images */
.chat-image {
  max-width: 100%;
  border-radius: 6px;
  margin-top: 6px;
  cursor: pointer;
}
```

**Step 12: Build and verify**

Run: `npx electron-vite build`
Expected: Build succeeds.

**Step 13: Commit**

```bash
git add src/renderer/clippy.ts src/renderer/chat.ts src/preload/index.ts src/main/ipc.ts src/main/openclaw/http-client.ts src/renderer/types.d.ts src/renderer/styles.css
git commit -m "feat: fullscreen screenshot capture with vision support"
```

---

## Task 4: Image Display in Chat

**Files:**
- Modify: `src/renderer/chat.ts` (extend `formatResponse()` for markdown images and image URLs)
- Modify: `src/renderer/styles.css` (image display styles — already partially done in Task 3)

**Step 1: Add image detection to formatResponse()**

In `src/renderer/chat.ts`, update `formatResponse()` to detect markdown images and bare image URLs. Add these two replacements AFTER the code block replacement but BEFORE the link replacement:

```typescript
function formatResponse(text: string): string {
  codeBlockCounter = 0
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      const id = `code-block-${++codeBlockCounter}`
      return `<div class="code-block-wrapper"><pre><code id="${id}">${escapeHtml(code)}</code></pre><button class="code-copy-btn" data-target="${id}" title="Copy">&#x2398;</button></div>`
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Markdown images: ![alt](url)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="chat-image" src="$2" alt="$1" />')
    // Bare image URLs (not already in an img or a tag)
    .replace(/(?<![="'])(https?:\/\/[^\s<)]+\.(?:png|jpe?g|gif|webp|svg))/gi,
      '<img class="chat-image" src="$1" />')
    // Clickable links — match URLs not already inside HTML tags
    .replace(/(?<![="'])(https?:\/\/[^\s<)]+)/g, '<a class="chat-link" href="$1">$1</a>')
    .replace(/\n/g, '<br>')
}
```

**Step 2: Add image click handler**

In `src/renderer/chat.ts`, extend the bubble click handler to open images:

```typescript
  // Image click — open in browser/viewer
  if (target.tagName === 'IMG' && target.classList.contains('chat-image')) {
    const src = (target as HTMLImageElement).src
    if (src && src.startsWith('http')) {
      window.clippy.openExternal(src)
    }
  }
```

**Step 3: Build and verify**

Run: `npx electron-vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/renderer/chat.ts
git commit -m "feat: render images in chat (markdown syntax and image URLs)"
```

---

## Task 5: Chat History — Storage Backend

**Files:**
- Create: `src/main/chat-history.ts`

**Step 1: Create chat history manager**

Create `src/main/chat-history.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface StoredConversation {
  id: string
  title: string
  createdAt: string
  messages: { role: string; content: string }[]
}

const MAX_CONVERSATIONS = 100

function getHistoryDir(): string {
  const dir = path.join(app.getPath('userData'), 'chat-history')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function saveConversation(convo: StoredConversation): void {
  const dir = getHistoryDir()
  const filePath = path.join(dir, `${convo.id}.json`)
  fs.writeFileSync(filePath, JSON.stringify(convo, null, 2))
  pruneOldConversations()
}

export function listConversations(): { id: string; title: string; createdAt: string }[] {
  const dir = getHistoryDir()
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))

  const summaries = files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      return { id: data.id, title: data.title, createdAt: data.createdAt }
    } catch {
      return null
    }
  }).filter(Boolean) as { id: string; title: string; createdAt: string }[]

  // Sort newest first
  summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return summaries
}

export function loadConversation(id: string): StoredConversation | null {
  const dir = getHistoryDir()
  const filePath = path.join(dir, `${id}.json`)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export function deleteConversation(id: string): void {
  const dir = getHistoryDir()
  const filePath = path.join(dir, `${id}.json`)
  try { fs.unlinkSync(filePath) } catch { /* ignore */ }
}

function pruneOldConversations(): void {
  const dir = getHistoryDir()
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))

  if (files.length <= MAX_CONVERSATIONS) return

  const withTime = files.map(f => ({
    file: f,
    mtime: fs.statSync(path.join(dir, f)).mtimeMs
  }))
  withTime.sort((a, b) => a.mtime - b.mtime)

  const toDelete = withTime.slice(0, files.length - MAX_CONVERSATIONS)
  for (const item of toDelete) {
    fs.unlinkSync(path.join(dir, item.file))
  }
}
```

**Step 2: Build and verify**

Run: `npx electron-vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/main/chat-history.ts
git commit -m "feat: chat history storage backend (save, list, load, prune)"
```

---

## Task 6: Chat History — IPC + Auto-Save

**Files:**
- Modify: `src/main/ipc.ts` (add history IPC handlers + auto-save on response)
- Modify: `src/preload/index.ts` (add history IPC bridges)
- Modify: `src/renderer/types.d.ts` (add types)

**Step 1: Add history IPC handlers**

In `src/main/ipc.ts`, add import at the top:

```typescript
import { saveConversation, listConversations, loadConversation, deleteConversation, StoredConversation } from './chat-history'
```

Then inside `setupIPC()`, add:

```typescript
  // Chat history
  let currentConvoId = new Date().toISOString().replace(/[:.]/g, '-')
  let currentConvoMessages: { role: string; content: string }[] = []

  ipcMain.handle('history:list', () => {
    return listConversations()
  })

  ipcMain.handle('history:load', (_event, id: string) => {
    return loadConversation(id)
  })

  ipcMain.on('history:delete', (_event, id: string) => {
    deleteConversation(id)
  })

  ipcMain.on('history:newChat', () => {
    currentConvoId = new Date().toISOString().replace(/[:.]/g, '-')
    currentConvoMessages = []
    chatClient.clearHistory()
    clippyWindow.webContents.send('chat:cleared')
  })
```

Then modify the existing `chat:send` handler to track messages:

```typescript
  ipcMain.on('chat:send', (_event, text: string) => {
    currentConvoMessages.push({ role: 'user', content: text })
    chatClient.send(text)
  })
```

And in the `chatClient.on('message')` handler, add auto-save when a response completes (inside the `case 'response':` block):

```typescript
      case 'response':
        clippyWindow.webContents.send('chat:response', msg)
        // Auto-save to history
        if (msg.content && !isHeartbeat) {
          currentConvoMessages.push({ role: 'assistant', content: msg.content })
          const title = currentConvoMessages.find(m => m.role === 'user')?.content?.slice(0, 50) || 'Chat'
          saveConversation({
            id: currentConvoId,
            title,
            createdAt: new Date().toISOString(),
            messages: currentConvoMessages
          })
        }
        break
```

**Step 2: Add history to preload**

In `src/preload/index.ts`, add:

```typescript
  // History
  listHistory: () => ipcRenderer.invoke('history:list'),
  loadHistory: (id: string) => ipcRenderer.invoke('history:load', id),
  deleteHistory: (id: string) => ipcRenderer.send('history:delete', id),
  newChat: () => ipcRenderer.send('history:newChat'),
  onChatCleared: (callback: () => void) =>
    ipcRenderer.on('chat:cleared', () => callback()),
```

**Step 3: Add types**

In `src/renderer/types.d.ts`, add:

```typescript
      // History
      listHistory: () => Promise<{ id: string; title: string; createdAt: string }[]>
      loadHistory: (id: string) => Promise<{ id: string; title: string; createdAt: string; messages: { role: string; content: string }[] } | null>
      deleteHistory: (id: string) => void
      newChat: () => void
      onChatCleared: (callback: () => void) => void
```

**Step 4: Build and verify**

Run: `npx electron-vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/main/ipc.ts src/preload/index.ts src/renderer/types.d.ts
git commit -m "feat: chat history IPC handlers with auto-save on response"
```

---

## Task 7: Chat History — UI (Header Buttons + History Panel)

**Files:**
- Modify: `src/renderer/clippy.ts` (add header with history + new chat buttons)
- Modify: `src/renderer/chat.ts` (add history panel + restore logic)
- Modify: `src/renderer/styles.css` (add history UI styles)

**Step 1: Add chat header to bubble**

In `src/renderer/clippy.ts`, update `createBubbleElement()`:

```typescript
private createBubbleElement(): HTMLElement {
  const el = document.createElement('div')
  el.id = 'clippy-bubble'
  el.className = 'clippy-bubble hidden'
  el.innerHTML = `
    <div class="bubble-header hidden">
      <button class="bubble-history-btn" title="Chat history">&#x1F552;</button>
      <button class="bubble-newchat-btn" title="New chat">&#x2795;</button>
    </div>
    <div class="bubble-content"></div>
    <div class="bubble-history-panel hidden"></div>
    <div class="bubble-input-area hidden">
      <div class="bubble-input-row">
        <input type="text" class="bubble-input" placeholder="Ask Clippy..." />
        <button class="bubble-screenshot-btn" title="Take screenshot">&#x1F4F7;</button>
      </div>
    </div>
    <div class="bubble-actions"></div>
  `
  return el
}
```

Update `showChat()` to also show the header:

```typescript
showChat(): void {
  const inputArea = this.bubbleEl.querySelector('.bubble-input-area') as HTMLElement
  const header = this.bubbleEl.querySelector('.bubble-header') as HTMLElement
  inputArea.classList.remove('hidden')
  header.classList.remove('hidden')
  this.bubbleEl.classList.remove('hidden')
  this.chatVisible = true
  const input = this.bubbleEl.querySelector('.bubble-input') as HTMLInputElement
  input.focus()
}

hideChat(): void {
  const inputArea = this.bubbleEl.querySelector('.bubble-input-area') as HTMLElement
  const header = this.bubbleEl.querySelector('.bubble-header') as HTMLElement
  inputArea.classList.add('hidden')
  header.classList.add('hidden')
  this.chatVisible = false
}
```

**Step 2: Add history panel logic in chat.ts**

In `src/renderer/chat.ts`, add to `initChat()`:

```typescript
  // History button
  const historyBtn = document.querySelector('.bubble-history-btn')
  const historyPanel = document.querySelector('.bubble-history-panel') as HTMLElement
  const contentEl = document.querySelector('.bubble-content') as HTMLElement

  historyBtn?.addEventListener('click', async () => {
    const isVisible = !historyPanel.classList.contains('hidden')
    if (isVisible) {
      historyPanel.classList.add('hidden')
      contentEl.classList.remove('hidden')
      return
    }

    const conversations = await window.clippy.listHistory()
    if (conversations.length === 0) {
      historyPanel.innerHTML = '<div class="history-empty">No previous chats yet.</div>'
    } else {
      historyPanel.innerHTML = conversations.map(c => {
        const date = new Date(c.createdAt).toLocaleDateString('de-DE', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        })
        return `<div class="history-item" data-id="${c.id}">
          <div class="history-title">${escapeHtml(c.title)}</div>
          <div class="history-date">${date}</div>
        </div>`
      }).join('')
    }

    contentEl.classList.add('hidden')
    historyPanel.classList.remove('hidden')
  })

  // Click on history item to load it
  historyPanel?.addEventListener('click', async (e) => {
    const item = (e.target as HTMLElement).closest('.history-item') as HTMLElement
    if (!item) return

    const id = item.dataset.id
    if (!id) return

    const convo = await window.clippy.loadHistory(id)
    if (!convo) return

    // Restore conversation in chat view
    let html = ''
    for (const msg of convo.messages) {
      if (msg.role === 'user') {
        html += `<div class="chat-user">${escapeHtml(msg.content)}</div>`
      } else {
        html += formatResponse(msg.content)
      }
    }

    historyPanel.classList.add('hidden')
    contentEl.classList.remove('hidden')
    contentEl.innerHTML = html
  })

  // New chat button
  const newChatBtn = document.querySelector('.bubble-newchat-btn')
  newChatBtn?.addEventListener('click', () => {
    window.clippy.newChat()
  })

  // Handle chat cleared event
  window.clippy.onChatCleared(() => {
    const content = document.querySelector('.bubble-content') as HTMLElement
    if (content) {
      content.innerHTML = '<span style="color:#888; font-size:12px;">Ask me anything...</span>'
    }
    currentResponse = ''
  })
```

**Step 3: Add history CSS**

Append to `src/renderer/styles.css`:

```css
/* Chat header */
.bubble-header {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #ddd;
}

.bubble-header.hidden {
  display: none;
}

.bubble-history-btn,
.bubble-newchat-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 13px;
}

.bubble-history-btn:hover,
.bubble-newchat-btn:hover {
  background: #e8e8e8;
}

/* History panel */
.bubble-history-panel {
  max-height: 350px;
  overflow-y: auto;
}

.bubble-history-panel.hidden {
  display: none;
}

.history-empty {
  color: #888;
  font-size: 12px;
  text-align: center;
  padding: 20px 0;
}

.history-item {
  padding: 8px 10px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.history-item:hover {
  background: #f5f5e8;
}

.history-title {
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-date {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
}
```

**Step 4: Build and verify**

Run: `npx electron-vite build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/renderer/clippy.ts src/renderer/chat.ts src/renderer/styles.css
git commit -m "feat: chat history UI with history panel and new chat button"
```

---

## Task 8: Final Integration + Build + Tag

**Files:**
- Modify: `package.json` (bump version to 0.4.0)

**Step 1: Bump version**

In `package.json`, change version from `"0.3.0"` to `"0.4.0"`.

**Step 2: Full build**

Run: `npx electron-vite build`
Expected: All 3 bundles build successfully.

**Step 3: Commit and tag**

```bash
git add -A
git commit -m "release: v0.4.0 — chat UX features (copy, links, screenshot, images, history)"
git tag v0.4.0
```

**Step 4: Push**

```bash
git push origin main --tags
```
