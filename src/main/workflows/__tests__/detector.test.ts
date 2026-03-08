import { describe, it, expect } from 'vitest'
import { WorkflowDetector } from '../detector'

describe('WorkflowDetector', () => {
  it('detects repeating 3-app sequence after 3 occurrences', () => {
    const detector = new WorkflowDetector()

    for (let day = 0; day < 3; day++) {
      const baseTime = new Date(2026, 2, 8 + day, 9, 0).getTime()
      detector.recordAppSwitch('slack', baseTime)
      detector.recordAppSwitch('gmail', baseTime + 60000)
      detector.recordAppSwitch('jira', baseTime + 120000)
    }

    const patterns = detector.detectPatterns()
    expect(patterns.length).toBeGreaterThan(0)
    expect(patterns[0].sequence).toEqual(['slack', 'gmail', 'jira'])
    expect(patterns[0].occurrences).toBe(3)
  })

  it('does not detect pattern with less than 3 occurrences', () => {
    const detector = new WorkflowDetector()

    for (let day = 0; day < 2; day++) {
      const baseTime = new Date(2026, 2, 8 + day, 9, 0).getTime()
      detector.recordAppSwitch('slack', baseTime)
      detector.recordAppSwitch('gmail', baseTime + 60000)
    }

    const patterns = detector.detectPatterns()
    expect(patterns).toHaveLength(0)
  })

  it('calculates average time', () => {
    const detector = new WorkflowDetector()

    for (let day = 0; day < 3; day++) {
      const baseTime = new Date(2026, 2, 8 + day, 9, 0).getTime()
      detector.recordAppSwitch('chrome', baseTime)
      detector.recordAppSwitch('vscode', baseTime + 60000)
    }

    const patterns = detector.detectPatterns()
    expect(patterns.length).toBeGreaterThan(0)
    expect(patterns[0].averageTime).toBe('09:00')
  })

  it('clears history', () => {
    const detector = new WorkflowDetector()
    detector.recordAppSwitch('test', Date.now())
    detector.clear()
    expect(detector.getHistory()).toHaveLength(0)
  })
})
