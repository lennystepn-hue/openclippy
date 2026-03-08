# Chat UX Features — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OpenClippy's chat usable as a real AI assistant interface — copyable text, clickable links, screenshot capture, image display, and persistent chat history.

**Architecture:** Incremental additions to the existing chat system (Approach A). All features build on `chat.ts`, `clippy.ts`, `formatResponse()`, and Electron IPC. No new frameworks or major refactoring.

**Tech Stack:** Electron (desktopCapturer, shell, Menu, clipboard), vanilla TypeScript, JSON file storage.

---

## 1. Text Copying

**Current state:** `user-select: none` on `body` blocks all text selection. No copy mechanism exists.

**Design:**
- Override `user-select: text` on `.speech-bubble` and chat message elements
- Add a copy-to-clipboard button on code blocks (appears on hover)
- Right-click context menu on messages with "Copy message" option via Electron `Menu.buildFromTemplate()`
- IPC channel `clipboard:copy` for renderer → main communication

## 2. Clickable Links

**Current state:** `formatResponse()` handles code blocks, bold, inline code, newlines — but not URLs.

**Design:**
- URL regex in `formatResponse()`: detects `https?://...` and wraps in `<a>` tags
- Links get `class="chat-link"` styling (underline, color)
- Click handler intercepts `<a>` clicks, sends URL via IPC `shell:openExternal`
- Main process calls `shell.openExternal(url)` with URL validation (only http/https)

## 3. Screenshot Capture (Fullscreen)

**Current state:** No screenshot capability.

**Design:**
- Camera icon button next to the send button in chat input area
- Click triggers IPC `screenshot:capture`
- Main process uses `desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } })`
- Returns PNG as base64 to renderer
- Renderer shows thumbnail preview in chat as user message
- Sends to OpenClaw as multipart content: `[{ type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }, { type: 'text', text: userMessage }]`
- If no text provided, default prompt: "What do you see on my screen?"

## 4. Image Display in Chat

**Current state:** No image rendering in messages.

**Design:**
- `formatResponse()` detects Markdown image syntax `![alt](url)` and renders `<img>` tags
- Also detects bare image URLs ending in `.png`, `.jpg`, `.gif`, `.webp`, `.svg`
- Images get `max-width: 100%; border-radius: 8px` within bubble
- Click on image opens it via `shell.openExternal()` or native viewer
- Base64 data URLs (from screenshots) render inline

## 5. Chat History

**Current state:** History lives only in `ClippyChatClient.history[]` — lost on restart.

**Design:**
- Storage: `userData/chat-history/` directory, one JSON file per conversation
- Filename: `YYYY-MM-DD_HH-mm-ss.json` (creation timestamp)
- Format: `{ id, title, createdAt, messages: ChatMessage[] }`
- Title: Auto-generated from first user message (truncated to 50 chars)
- Auto-save: After each assistant response completes
- UI: History button (clock icon) in chat header area
  - Opens a scrollable list of past conversations
  - Each entry shows title + date
  - Click loads conversation into chat view and restores to `ClippyChatClient.history`
- "New Chat" button clears current conversation and starts fresh
- IPC channels: `history:list`, `history:load`, `history:save`, `history:newChat`
- Max stored conversations: 100 (oldest auto-deleted)
