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
