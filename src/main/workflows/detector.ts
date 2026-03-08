export interface WorkflowPattern {
  sequence: string[]
  occurrences: number
  averageTime: string
  lastSeen: number
}

interface AppSwitch {
  app: string
  timestamp: number
}

export class WorkflowDetector {
  private switches: AppSwitch[] = []
  private minOccurrences = 3

  recordAppSwitch(app: string, timestamp = Date.now()): void {
    this.switches.push({ app, timestamp })
  }

  detectPatterns(): WorkflowPattern[] {
    const patterns: WorkflowPattern[] = []
    const days = this.groupByDay()
    if (days.length < this.minOccurrences) return []

    for (let seqLen = 2; seqLen <= 5; seqLen++) {
      const sequences = new Map<string, { count: number; times: number[] }>()

      for (const day of days) {
        const seen = new Set<string>()
        for (let i = 0; i <= day.length - seqLen; i++) {
          const seq = day.slice(i, i + seqLen).map(s => s.app)
          const key = seq.join(' -> ')
          if (seen.has(key)) continue
          seen.add(key)

          const entry = sequences.get(key) ?? { count: 0, times: [] }
          entry.count++
          entry.times.push(day[i].timestamp)
          sequences.set(key, entry)
        }
      }

      for (const [key, data] of sequences) {
        if (data.count >= this.minOccurrences) {
          const avgMs = data.times.reduce((a, b) => a + b, 0) / data.times.length
          const avgDate = new Date(avgMs)
          patterns.push({
            sequence: key.split(' -> '),
            occurrences: data.count,
            averageTime: `${String(avgDate.getHours()).padStart(2, '0')}:${String(avgDate.getMinutes()).padStart(2, '0')}`,
            lastSeen: Math.max(...data.times)
          })
        }
      }
    }

    return patterns.sort((a, b) => b.occurrences - a.occurrences || b.sequence.length - a.sequence.length)
  }

  private groupByDay(): AppSwitch[][] {
    const days = new Map<string, AppSwitch[]>()
    for (const sw of this.switches) {
      const date = new Date(sw.timestamp).toISOString().split('T')[0]
      if (!days.has(date)) days.set(date, [])
      days.get(date)!.push(sw)
    }
    return Array.from(days.values())
  }

  getHistory(): AppSwitch[] {
    return [...this.switches]
  }

  clear(): void {
    this.switches = []
  }
}
