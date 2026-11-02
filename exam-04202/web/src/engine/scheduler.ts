import {
  abilities,
  examProb,
  forecast,
  keepOf,
  knowProb,
  params,
  learned,
  LEARN,
  learnTime,
  MASTERED,
  observe,
  score,
  SLIP,
  GUESS,
  testTime,
} from './model'
import type { Bank, Item, ItemState, Kind, Progress, Response } from './types'

export function newProgress(bank: Bank): Progress {
  return { v: 1, step: 0, items: {}, calib: placement(bank), started: false, secs: 0, paceN: 0, paceSum: 0 }
}

/** Short placement set: one question per common subject, five professional sections, three multiple choice. */
export function placement(bank: Bank): string[] {
  const pick = (k: Kind, limit: number) => {
    const bySec = new Map<string, Item[]>()
    for (const it of bank.items) {
      if (it.k !== k || it.img) continue
      if (!bySec.has(it.s)) bySec.set(it.s, [])
      bySec.get(it.s)!.push(it)
    }
    const out: string[] = []
    for (const list of bySec.values()) {
      const short = [...list].sort((a, b) => a.n - b.n).slice(0, 8)
      out.push(short[Math.floor(Math.random() * short.length)].id)
    }
    return shuffle(out).slice(0, limit)
  }
  return shuffle([...pick('c', 4), ...pick('p', 5), ...pick('m', 3)])
}

export function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export function state(prog: Progress, id: string): ItemState {
  return prog.items[id] ?? { p: 0, seen: 0, tries: 0, right: 0 }
}

/** Below this chance of knowing it, a question starts with the answer card instead of being asked. */
export const LEARN_FIRST = 0.3
/** Questions between seeing an answer and being asked it again. */
export const MIN_GAP = 4

export type CardKind = 'learn' | 'test'

export interface Plan {
  kind: CardKind
  gain: number // expected exam points
  secs: number
}

/** What to do with an item next, and the expected exam points per second of doing it. */
export function plan(it: Item, st: ItemState | undefined, ab: Map<string, number>): Plan {
  const p = knowProb(it, st, ab)
  const now = score(it.k, p, keepOf(st))
  const seen = (st?.seen ?? 0) > 0
  if (!seen && p < LEARN_FIRST) {
    const after = score(it.k, learned(p), params.keepSeen)
    return { kind: 'learn', gain: it.w * (after - now), secs: learnTime(it) }
  }
  const pr = p * (1 - SLIP[it.k]) + (1 - p) * GUESS[it.k]
  const pRight = (p * (1 - SLIP[it.k])) / pr
  const ifRight = score(it.k, Math.max(MASTERED, pRight), params.keepTested)
  const ifWrong = score(it.k, learned(observe(p, it.k, 'wrong')), params.keepSeen)
  const after = pr * ifRight + (1 - pr) * ifWrong
  return { kind: 'test', gain: it.w * Math.max(0, after - now), secs: testTime(it) + (1 - pr) * learnTime(it) }
}

export interface Pick {
  id: string
  placement: boolean
  learn: boolean
}

export interface NextOptions {
  only?: Set<string> // limit to these ids (wrong-answer practice); always asks
  reviewFirst?: boolean // ask every seen question again before taking new ones
  maxLearnRun?: number // after this many answer cards in a row, ask a due question if there is one
}


/** Choose the next card: the one with the most expected exam points per second. */
export function next(bank: Bank, prog: Progress, opt: NextOptions = {}): Pick | null {
  const { only, reviewFirst } = opt
  const maxRun = opt.maxLearnRun ?? params.maxLearnRun
  const mustAsk = (prog.learnRun ?? 0) >= maxRun
  if (!only) {
    while (prog.calib.length) {
      const id = prog.calib[0]
      if (!prog.items[id]?.first) return { id, placement: true, learn: false }
      prog.calib.shift()
    }
  }
  const ab = abilities(bank, prog)
  const pool = only ? [...only].map((id) => index(bank).get(id)!).filter(Boolean) : bank.items
  let best: Pick | null = null
  let bestRate = -1
  let fallback: Pick | null = null
  let fallbackDue = Infinity
  for (const it of pool) {
    const st = prog.items[it.id]
    if (st?.done) continue
    const waiting = st?.due !== undefined && st.due > prog.step
    if (waiting) {
      if (st!.due! < fallbackDue) {
        fallbackDue = st!.due!
        fallback = { id: it.id, placement: false, learn: false }
      }
      continue
    }
    const pl = plan(it, st, ab)
    let rate = pl.gain / pl.secs
    if ((reviewFirst || mustAsk) && st?.due !== undefined) rate += 1 // due questions before anything new
    if (only) rate += 0 // practice: always ask
    if (rate > bestRate) {
      bestRate = rate
      best = { id: it.id, placement: false, learn: !only && pl.kind === 'learn' }
    }
  }
  if (best && bestRate > 1e-7) return best
  return fallback
}

/** The answer card was shown before asking. */
export function study(bank: Bank, prog: Progress, id: string) {
  const it = index(bank).get(id)!
  const ab = abilities(bank, prog)
  const st: ItemState = { ...state(prog, id) }
  st.p = learned(st.tries + st.seen > 0 ? st.p : knowProb(it, undefined, ab))
  st.seen++
  st.lastSeen = prog.step
  st.gap = MIN_GAP
  st.due = prog.step + MIN_GAP
  prog.step++
  prog.learnRun = (prog.learnRun ?? 0) + 1
  prog.items[id] = st
}

/**
 * Record an answer. Returns true when the item is learned and no answer needs to be shown,
 * false when the answer should be shown (the item comes back later).
 */
export function answer(bank: Bank, prog: Progress, id: string, r: Response, secs?: number): boolean {
  const it = index(bank).get(id)!
  const ab = abilities(bank, prog)
  const st: ItemState = { ...state(prog, id) }
  const before = st.tries + st.seen > 0 ? st.p : knowProb(it, undefined, ab)
  st.p = observe(before, it.k, r)
  st.tries++
  if (r === 'right') {
    st.right++
    st.lastRight = prog.step
  }
  if (!st.first) st.first = r
  prog.step++
  prog.learnRun = 0
  if (secs !== undefined && secs > 0 && secs < 300) {
    prog.secs += secs
    prog.paceN++
    prog.paceSum += Math.min(3, Math.max(0.3, secs / testTime(it)))
  }
  if (r === 'right' && st.p >= MASTERED) {
    st.done = true
    st.due = undefined
    st.gap = undefined
    prog.items[id] = st
    return true
  }
  st.p = learned(st.p)
  st.seen++
  st.lastSeen = prog.step
  st.done = false
  st.gap = r === 'right' ? Math.max(6, (st.gap ?? MIN_GAP) * 2) : MIN_GAP
  st.due = prog.step + st.gap
  if (r !== 'right') st.wrongAt = prog.step
  prog.items[id] = st
  return false
}

/** Mock exam answers update what the student knows; wrong ones come back in study. */
export function examAnswer(bank: Bank, prog: Progress, id: string, r: Response) {
  const it = index(bank).get(id)!
  const ab = abilities(bank, prog)
  const st: ItemState = { ...state(prog, id) }
  const before = st.tries + st.seen > 0 ? st.p : knowProb(it, undefined, ab)
  st.p = observe(before, it.k, r)
  st.tries++
  if (!st.first) st.first = r
  if (r === 'right') {
    st.right++
    st.lastRight = prog.step
    if (st.p >= MASTERED) {
      st.done = true
      st.due = undefined
    }
  } else {
    st.done = false
    st.wrongAt = prog.step
    st.due = prog.step
    st.gap = MIN_GAP
  }
  prog.items[id] = st
}

export function probabilities(bank: Bank, prog: Progress): Map<string, number> {
  const ab = abilities(bank, prog)
  const m = new Map<string, number>()
  for (const it of bank.items) m.set(it.id, examProb(it, prog.items[it.id], ab))
  return m
}

export function pace(prog: Progress): number {
  if (prog.paceN < 8) return 1
  return Math.min(2, Math.max(0.6, prog.paceSum / prog.paceN))
}

export interface Status {
  mean: number
  pass: number
  minutes: number // minutes of study to reach TARGET pass chance
}

export const TARGET = 0.8

export function status(bank: Bank, prog: Progress): Status {
  const probs = probabilities(bank, prog)
  const f = forecast(bank, probs)
  return { ...f, minutes: minutesTo(bank, prog, TARGET, probs) }
}

/** Minutes of study to reach the target pass chance, following the same order the app uses. */
export function minutesTo(bank: Bank, prog: Progress, target: number, probs?: Map<string, number>): number {
  const pr = new Map(probs ?? probabilities(bank, prog))
  if (forecast(bank, pr).pass >= target) return 0
  const ab = abilities(bank, prog)
  // greedy by rate; each item is first read, then checked once
  const order = bank.items
    .filter((it) => !prog.items[it.id]?.done)
    .map((it) => {
      const pl = plan(it, prog.items[it.id], ab)
      return { it, rate: pl.gain / pl.secs }
    })
    .sort((a, b) => b.rate - a.rate)
  // one look and one question; a miss (about 1 - LEARN of the time) costs another round
  const miss = 1 - LEARN
  const after = (k: Kind) => score(k, 1 - miss * miss * 0.5, (params.keepSeen + params.keepTested) / 2)
  const pf = pace(prog)
  let secs = 0
  for (let i = 0; i < order.length; i++) {
    const { it } = order[i]
    pr.set(it.id, Math.max(pr.get(it.id)!, after(it.k)))
    secs += (learnTime(it) + testTime(it)) * (1 + miss) * pf
    if (i % 5 === 4 && forecast(bank, pr).pass >= target) break
  }
  return Math.ceil(secs / 60)
}

const cache = new WeakMap<Bank, Map<string, Item>>()
export function index(bank: Bank): Map<string, Item> {
  let m = cache.get(bank)
  if (!m) {
    m = new Map(bank.items.map((it) => [it.id, it]))
    cache.set(bank, m)
  }
  return m
}
