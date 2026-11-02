import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { forecast, observe, learned } from './model'
import { answer, newProgress, next, probabilities, study } from './scheduler'
import type { Bank } from './types'

const bank: Bank = JSON.parse(readFileSync(new URL('../data/04202/bank.json', import.meta.url), 'utf8'))

describe('knowledge model', () => {
  it('moves the estimate in the right direction', () => {
    expect(observe(0.3, 'p', 'right')).toBeGreaterThan(0.3)
    expect(observe(0.3, 'p', 'wrong')).toBeLessThan(0.3)
    expect(observe(0.3, 'p', 'unknown')).toBeLessThan(observe(0.3, 'p', 'wrong') + 1e-9)
    expect(learned(0.2)).toBeGreaterThan(0.2)
  })

  it('a correct multiple-choice answer counts more than a correct single-choice one', () => {
    expect(observe(0.3, 'm', 'right')).toBeGreaterThan(observe(0.3, 'p', 'right'))
  })

  it('pass chance is near 0 when guessing and near 1 when everything is known', () => {
    const guess = new Map(bank.items.map((it) => [it.id, it.k === 'm' ? 0.1 : 0.25]))
    const all = new Map(bank.items.map((it) => [it.id, 0.97]))
    expect(forecast(bank, guess).pass).toBeLessThan(0.01)
    expect(forecast(bank, all).pass).toBeGreaterThan(0.99)
    expect(forecast(bank, guess).mean).toBeCloseTo(44 * 0.25 + 16 * 0.25 + 40 * 0.1, 0)
  })
})

describe('scheduler', () => {
  it('starts with the 12 placement questions', () => {
    const prog = newProgress(bank)
    expect(prog.calib).toHaveLength(12)
    const first = next(bank, prog)!
    expect(first.placement).toBe(true)
    expect(prog.calib).toContain(first.id)
  })

  it('never asks an item again right after showing its answer', () => {
    const prog = newProgress(bank)
    for (const id of [...prog.calib]) answer(bank, prog, id, 'unknown')
    const seenAt = new Map<string, number>()
    for (let i = 0; i < 80; i++) {
      const pk = next(bank, prog)!
      if (seenAt.has(pk.id)) expect(prog.step - seenAt.get(pk.id)!).toBeGreaterThanOrEqual(3)
      if (pk.learn) study(bank, prog, pk.id)
      else if (!answer(bank, prog, pk.id, 'right')) seenAt.set(pk.id, prog.step)
      if (pk.learn) seenAt.set(pk.id, prog.step)
    }
  })

  it('studying raises the predicted score', () => {
    const prog = newProgress(bank)
    for (const id of [...prog.calib]) answer(bank, prog, id, 'unknown')
    const before = forecast(bank, probabilities(bank, prog)).mean
    for (let i = 0; i < 120; i++) {
      const pk = next(bank, prog)!
      if (pk.learn) study(bank, prog, pk.id)
      else answer(bank, prog, pk.id, 'right')
    }
    expect(forecast(bank, probabilities(bank, prog)).mean).toBeGreaterThan(before + 5)
  })

  it('every item has a memory key for each option that needs one', () => {
    for (const it of bank.items) {
      if (it.k === 'm') {
        for (let i = 0; i < 4; i++) if (!it.a.includes(i + 1)) expect(it.key[i], it.id).toBeTruthy()
      } else expect(it.key[it.a[0] - 1] ?? '', it.id).not.toBe(undefined)
      expect(it.o).toHaveLength(4)
    }
  })
})
