import { useCallback, useState } from 'react'
import { newProgress } from './engine/scheduler'
import type { Progress } from './engine/types'
import { bank } from './data'

const KEY = `study-${bank.meta.code}-v1`

function load(): Progress {
  let p: Progress | null = null
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && v.v === 1 && v.items) p = v as Progress
  } catch {
    /* storage unavailable */
  }
  return p ?? newProgress(bank)
}

export function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
}

/** Progress lives in one mutable object; `touch` re-renders after the engine changed it. */
export function useProgress() {
  const [prog, setProg] = useState<Progress>(load)
  const [, setTick] = useState(0)
  const touch = useCallback(() => {
    save(prog)
    setTick((t) => t + 1)
  }, [prog])
  const reset = useCallback(() => {
    const p = newProgress(bank)
    save(p)
    setProg(p)
  }, [])
  return { prog, touch, reset }
}
