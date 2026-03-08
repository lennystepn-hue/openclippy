import { describe, it, expect } from 'vitest'
import { WizardFlow, WIZARD_STEPS } from '../wizard-steps'

describe('WizardFlow', () => {
  it('starts at step 0 (OpenClaw)', () => {
    const flow = new WizardFlow()
    expect(flow.currentStep()).toBe(0)
    expect(flow.currentStepName()).toBe('openclaw')
  })

  it('has 8 steps total', () => {
    expect(WIZARD_STEPS).toHaveLength(8)
  })

  it('advances through all steps', () => {
    const flow = new WizardFlow()
    for (let i = 0; i < 7; i++) {
      expect(flow.hasNext()).toBe(true)
      flow.next()
    }
    expect(flow.hasNext()).toBe(false)
  })

  it('can go back', () => {
    const flow = new WizardFlow()
    flow.next()
    flow.next()
    flow.back()
    expect(flow.currentStep()).toBe(1)
  })

  it('reports completion on last step', () => {
    const flow = new WizardFlow()
    for (let i = 0; i < 7; i++) flow.next()
    expect(flow.isComplete()).toBe(true)
  })
})
