/**
 * Simulates students using the app and estimates the chance of passing after a given study time.
 *
 *   npx tsx scripts/simulate.ts
 *
 * A simulated student knows each common-subject question with probability `commonSense` and none
 * of the professional bank. Reading an answer card teaches it with probability `learn`. At the
 * exam, an answer that was only read is remembered with probability `keepSeen`; one that was also
 * recalled correctly later is remembered with probability `keepTested`. Reading and answering
 * times follow the app's time model with ±30% noise.
 */
import { readFileSync } from 'node:fs'
import { answer, newProgress, next, shuffle, study } from '../src/engine/scheduler'
import { learnTime, pools, testTime } from '../src/engine/model'
import type { Bank, Item } from '../src/engine/types'

const bank: Bank = JSON.parse(readFileSync(new URL('../src/data/04202/bank.json', import.meta.url), 'utf8'))
const byId = new Map(bank.items.map((it) => [it.id, it]))

export interface Student {
  commonSense: number
  learn: number
  keepSeen: number
  keepTested: number
}

type Mem = 'none' | 'prior' | 'seen' | 'tested'

function passRate(mem: Map<string, Mem>, st: Student, trials = 300): number {
  let pass = 0
  const ps = pools(bank)
  for (let t = 0; t < trials; t++) {
    let total = 0
    for (const pool of ps) {
      for (const it of shuffle(pool.items).slice(0, pool.draw)) {
        const m = mem.get(it.id)!
        const keep = m === 'prior' ? 1 : m === 'tested' ? st.keepTested : m === 'seen' ? st.keepSeen : 0
        const k = Math.random() < keep
        const g = it.k === 'm' ? 0.1 : 0.25
        if (k ? Math.random() < 0.96 : Math.random() < g) total += pool.pts
      }
    }
    if (total >= 60) pass++
  }
  return pass / trials
}

export type Policy = 'app' | 'review-first' | 'bank-order'

export function run(st: Student, minutes: number[], policy: Policy, maxLearnRun?: number): number[] {
  const prog = newProgress(bank)
  const mem = new Map<string, Mem>()
  for (const it of bank.items) mem.set(it.id, it.k === 'c' && Math.random() < st.commonSense ? 'prior' : 'none')
  const knows = (id: string) => mem.get(id) !== 'none'
  const noise = () => 0.7 + Math.random() * 0.6
  const read = (it: Item) => {
    if (mem.get(it.id) === 'none' && Math.random() < st.learn) mem.set(it.id, 'seen')
  }
  const ask = (it: Item) => {
    const k = knows(it.id)
    const g = it.k === 'm' ? 0.1 : 0.25
    const right = k ? Math.random() < 0.96 : Math.random() < g
    const r = right ? 'right' : k ? 'wrong' : Math.random() < 0.6 ? 'unknown' : 'wrong'
    if (right && mem.get(it.id) === 'seen') mem.set(it.id, 'tested')
    return r as 'right' | 'wrong' | 'unknown'
  }
  let secs = 0
  let cursor = 0
  const queue: { id: string; due: number }[] = []
  const out: number[] = []
  for (const m of minutes) {
    while (secs < m * 60) {
      if (policy === 'bank-order') {
        // a traditional app: questions in bank order, answer first, wrong ones again 4 cards later
        const qi = queue.findIndex((q) => q.due <= prog.step)
        const it = qi >= 0 ? byId.get(queue.splice(qi, 1)[0].id)! : bank.items[cursor++]
        if (!it) break
        const r = ask(it)
        secs += testTime(it) * noise()
        prog.step++
        if (r !== 'right') {
          read(it)
          secs += learnTime(it) * noise()
          queue.push({ id: it.id, due: prog.step + 4 })
        }
        continue
      }
      const pk = next(bank, prog, { reviewFirst: policy === 'review-first', maxLearnRun })
      if (!pk) break
      const it = byId.get(pk.id)!
      if (pk.learn) {
        study(bank, prog, it.id)
        read(it)
        secs += learnTime(it) * noise()
        continue
      }
      const r = ask(it)
      secs += testTime(it) * noise()
      if (!answer(bank, prog, it.id, r)) {
        read(it)
        secs += learnTime(it) * noise()
      }
    }
    out.push(passRate(mem, st))
  }
  return out
}

if (process.argv[1]?.endsWith('simulate.ts')) {
  const minutes = [0, 30, 45, 60, 75, 90, 120, 150]
  const students: [string, Student][] = [
    ['記性普通', { commonSense: 0.6, learn: 0.55, keepSeen: 0.8, keepTested: 0.95 }],
    ['記性較差', { commonSense: 0.5, learn: 0.4, keepSeen: 0.7, keepTested: 0.9 }],
    ['記性好  ', { commonSense: 0.7, learn: 0.7, keepSeen: 0.85, keepTested: 0.97 }],
  ]
  const RUNS = Number(process.env.RUNS ?? 10)
  console.log('讀書分鐘          ' + minutes.map((m) => String(m).padStart(5)).join(''))
  for (const [name, st] of students) {
    for (const policy of ['app', 'review-first', 'bank-order'] as Policy[]) {
      const acc = minutes.map(() => 0)
      for (let r = 0; r < RUNS; r++) run(st, minutes, policy).forEach((v, i) => (acc[i] += v / RUNS))
      console.log(`${name} ${policy.padEnd(13)}${acc.map((v) => ((v * 100).toFixed(0) + '%').padStart(5)).join('')}`)
    }
  }
}
