import type { Bank, Item, ItemState, Kind, Progress, Response } from './types'

// Knowledge tracing parameters
export const GUESS: Record<Kind, number> = { p: 0.25, c: 0.25, m: 0.1 }
export const SLIP: Record<Kind, number> = { p: 0.05, c: 0.05, m: 0.1 }
export const LEARN = 0.55 // chance an answer is learned after seeing it once
/**
 * keepSeen: chance an answer that was only read is still remembered at the exam.
 * keepTested: same, for an answer that was later recalled correctly.
 * maxLearnRun: answer cards allowed in a row before a due question is asked. Simulations
 * (scripts/simulate.ts) found that forcing questions early costs more than it brings, so it is off.
 */
export const params = { keepSeen: 0.8, keepTested: 0.95, maxLearnRun: 1000 }
export const MASTERED = 0.85
const PRIOR: Record<Kind, number> = { p: 0.04, m: 0.03, c: 0.35 }
const PRIOR_WEIGHT = 4

/** Posterior update after one answer. */
export function observe(p: number, k: Kind, r: Response): number {
  const g = GUESS[k]
  const s = SLIP[k]
  if (r === 'right') return (p * (1 - s)) / (p * (1 - s) + (1 - p) * g)
  if (r === 'wrong') return (p * s) / (p * s + (1 - p) * (1 - g))
  return (p * s) / (p * s + (1 - p)) // "I don't know": no guessing involved
}

/** After the answer has been shown. */
export function learned(p: number): number {
  return p + (1 - p) * LEARN
}

/** Ability per section from first attempts, shrunk toward the kind-level estimate. */
export function abilities(bank: Bank, prog: Progress): Map<string, number> {
  const groups = new Map<string, Response[]>()
  const kinds = new Map<Kind, Response[]>()
  for (const it of bank.items) {
    const st = prog.items[it.id]
    if (!st?.first) continue
    const g = it.k + '|' + it.s
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(st.first)
    if (!kinds.has(it.k)) kinds.set(it.k, [])
    kinds.get(it.k)!.push(st.first)
  }
  const kindTheta = new Map<Kind, number>()
  for (const k of ['p', 'm', 'c'] as Kind[]) kindTheta.set(k, estimate(kinds.get(k) ?? [], k, PRIOR[k], PRIOR_WEIGHT))
  const out = new Map<string, number>()
  for (const [k, s] of bank.meta.sections) {
    out.set(k + '|' + s, estimate(groups.get(k + '|' + s) ?? [], k, kindTheta.get(k)!, PRIOR_WEIGHT))
  }
  return out
}

/** Posterior mean of ability on a grid, Beta prior with given mean and weight. */
function estimate(rs: Response[], k: Kind, mean: number, weight: number): number {
  const g = GUESS[k]
  const s = SLIP[k]
  const a = Math.max(mean * weight, 0.05)
  const b = Math.max((1 - mean) * weight, 0.05)
  let num = 0
  let den = 0
  for (let i = 1; i < 50; i++) {
    const t = i / 50
    let lp = (a - 1) * Math.log(t) + (b - 1) * Math.log(1 - t)
    for (const r of rs) {
      const pr = t * (1 - s) + (1 - t) * g
      if (r === 'right') lp += Math.log(pr)
      else if (r === 'wrong') lp += Math.log(1 - pr)
      else lp += Math.log(1 - t * (1 - s)) // did not know
    }
    const w = Math.exp(lp)
    num += w * t
    den += w
  }
  return den > 0 ? num / den : mean
}

export function knowProb(it: Item, st: ItemState | undefined, ab: Map<string, number>): number {
  if (st && st.tries + st.seen > 0) return st.p
  return ab.get(it.k + '|' + it.s) ?? PRIOR[it.k]
}

/** Chance of getting the item right in the real exam. */
export function keepOf(st: ItemState | undefined): number {
  if (!st || st.seen === 0) return 1
  return st.right > 0 && (st.lastRight ?? 0) > (st.lastSeen ?? 0) ? params.keepTested : params.keepSeen
}

export function score(k: Kind, p: number, keep: number): number {
  const known = p * keep
  return known * (1 - SLIP[k]) + (1 - known) * GUESS[k]
}

/** Chance of getting the item right in the real exam. */
export function examProb(it: Item, st: ItemState | undefined, ab: Map<string, number>): number {
  return score(it.k, knowProb(it, st, ab), keepOf(st))
}

/** Exam pools: professional single, multiple choice, and one pool per common subject. */
export function pools(bank: Bank): { items: Item[]; draw: number; pts: number }[] {
  const by = new Map<string, Item[]>()
  for (const it of bank.items) {
    const key = it.k === 'c' ? 'c|' + it.s : it.k
    if (!by.has(key)) by.set(key, [])
    by.get(key)!.push(it)
  }
  const d = bank.meta.exam.draw
  return [...by.entries()].map(([key, items]) => ({
    items,
    draw: d[key[0] as Kind],
    pts: key === 'm' ? 2 : 1,
  }))
}

/** Normal approximation of the exam score distribution; returns mean and chance of passing. */
export function forecast(bank: Bank, probs: Map<string, number>): { mean: number; pass: number } {
  let mean = 0
  let vari = 0
  for (const pool of pools(bank)) {
    const ps = pool.items.map((it) => probs.get(it.id)!)
    const N = ps.length
    const n = Math.min(pool.draw, N)
    const m = ps.reduce((a, b) => a + b, 0) / N
    const within = ps.reduce((a, p) => a + p * (1 - p), 0) / N
    const between = ps.reduce((a, p) => a + (p - m) ** 2, 0) / N
    mean += pool.pts * n * m
    vari += pool.pts ** 2 * n * (within + (between * (N - n)) / Math.max(1, N - 1))
  }
  const sd = Math.sqrt(Math.max(vari, 1e-6))
  const pass = 1 - phi((bank.meta.exam.pass - 0.5 - mean) / sd)
  return { mean, pass }
}

export function phi(x: number): number {
  // Abramowitz-Stegun approximation of the normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

const len = (t: string) => t.replace(/\s+/g, '').length

export const tuning = { learnScale: 1 }

/** Seconds for a first look at the answer card. */
export function learnTime(it: Item): number {
  return tuning.learnScale * learnTimeFull(it)
}

function learnTimeFull(it: Item): number {
  const stem = len(it.q) / 14
  if (it.k === 'm') {
    const wrong = it.o.filter((_, i) => !it.a.includes(i + 1)).reduce((a, o) => a + len(o), 0)
    return 2.5 + stem + wrong / 12
  }
  return 2 + stem + len(it.o[it.a[0] - 1]) / 10
}

/** Seconds to answer it as an exam question. */
export function testTime(it: Item): number {
  const opts = it.o.reduce((a, o) => a + len(o), 0)
  return (it.k === 'm' ? 3 : 1.5) + len(it.q) / 14 + opts / 16
}

/** Estimated seconds to learn an item: one look plus one check. */
export function cost(it: Item): number {
  return learnTime(it) + testTime(it)
}
