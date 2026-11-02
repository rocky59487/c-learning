export type Kind = 'p' | 'm' | 'c' // professional single, multiple choice, common subject single

export interface Item {
  id: string
  k: Kind
  s: string // section
  q: string // stem
  o: string[] // four options
  a: number[] // correct options, 1-based
  w: number // expected exam points carried by this item
  n: number // text length, used for time estimates
  key: Record<string, string> // option index (0-based) -> memory key
  sk?: string // stem keyword when the answer key alone is not unique
  img?: string
  tw?: string[] // look-alike questions
  ex?: string // explanation
  tip?: string // short way to remember
  wx?: Record<string, string> // why a wrong option is wrong
}

export interface Bank {
  meta: {
    code: string
    name: string
    exam: { single: number; multi: number; pass: number; draw: Record<Kind, number> }
    sections: [Kind, string][]
    source: string
  }
  items: Item[]
}

export type Response = 'right' | 'wrong' | 'unknown'

export interface ItemState {
  p: number // probability the student knows it
  seen: number // times the answer was shown
  tries: number
  right: number
  first?: Response // first attempt, used to estimate ability
  due?: number // step when it should come back
  gap?: number
  done?: boolean // learned well enough, no more reviews needed
  wrongAt?: number // last step answered wrong
  lastSeen?: number // step when the answer was last shown
  lastRight?: number // step of the last correct answer
}

export interface Progress {
  v: 1
  step: number
  items: Record<string, ItemState>
  calib: string[] // remaining placement questions
  started: boolean
  secs: number // seconds spent studying
  paceN: number // answers timed
  paceSum: number // sum of (actual / estimated) time ratios
  learnRun?: number // answer cards shown in a row without a question
}
