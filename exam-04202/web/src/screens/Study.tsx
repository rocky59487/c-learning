import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { bank, byId, KIND_LABEL } from '../data'
import { answer, next, probabilities, shuffle, study, type Pick } from '../engine/scheduler'
import { forecast } from '../engine/model'
import type { Progress, Response } from '../engine/types'
import { Figure, LearnCard, Solution } from '../components/Cards'
import { Bar } from '../components/Bar'
import { Placement } from './Placement'

type Phase = 'ask' | 'result' | 'learn'
const PLACEMENT = 12

export function Study({ prog, touch, onExit, only }: { prog: Progress; touch: () => void; onExit: () => void; only?: Set<string> }) {
  const [pick, setPick] = useState<Pick | null>(() => next(bank, prog, { only }))
  const [phase, setPhase] = useState<Phase>(() => (pick?.learn ? 'learn' : 'ask'))
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [flash, setFlash] = useState<string | null>(null)
  const [summary, setSummary] = useState(false)
  const shownAt = useRef(performance.now())
  const it = pick ? byId.get(pick.id)! : null
  const order = useMemo(() => (it ? (it.img ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3])) : []), [pick]) // eslint-disable-line react-hooks/exhaustive-deps
  const pass = useMemo(() => forecast(bank, probabilities(bank, prog)).pass, [pick, phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const lastPass = useRef(pass)

  useEffect(() => {
    for (const m of [0.5, 0.8]) {
      if (lastPass.current < m && pass >= m) setFlash(`及格機率到 ${Math.round(m * 100)}% 了`)
    }
    lastPass.current = pass
  }, [pass])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 1400)
    return () => clearTimeout(t)
  }, [flash])

  const advance = useCallback(() => {
    const wasPlacement = pick?.placement
    const p = next(bank, prog, { only })
    if (wasPlacement && !only && !prog.calib.length && !prog.started) {
      prog.started = true
      touch()
      setSummary(true)
    }
    setPick(p)
    setPhase(p?.learn ? 'learn' : 'ask')
    setChosen(new Set())
    shownAt.current = performance.now()
    window.scrollTo(0, 0)
  }, [pick, prog, only, touch])

  const submit = useCallback(
    (r: Response, sel: Set<number>) => {
      if (!it || phase !== 'ask') return
      setChosen(sel)
      const secs = (performance.now() - shownAt.current) / 1000
      const done = answer(bank, prog, it.id, r, secs)
      touch()
      if (done) {
        setFlash('答對了')
        setPhase('result')
        setTimeout(advance, 450)
      } else setPhase('result')
    },
    [it, phase, prog, touch, advance],
  )

  const grade = useCallback(
    (sel: Set<number>) => {
      if (!it) return
      const ok = sel.size === it.a.length && it.a.every((a) => sel.has(a - 1))
      submit(ok ? 'right' : 'wrong', sel)
    },
    [it, submit],
  )

  const learnNext = useCallback(() => {
    if (!it) return
    study(bank, prog, it.id)
    touch()
    advance()
  }, [it, prog, touch, advance])

  // keyboard: 1-4 choose, Enter confirm / next, 0 = don't know
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!it || summary) return
      if (phase === 'learn' && (e.key === 'Enter' || e.key === ' ')) return learnNext()
      if (phase === 'result' && (e.key === 'Enter' || e.key === ' ')) return advance()
      if (phase !== 'ask') return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) {
        const k = order[n - 1]
        if (it.k === 'm') setChosen((s) => toggle(s, k))
        else grade(new Set([k]))
      } else if (e.key === '0') submit('unknown', new Set())
      else if (e.key === 'Enter' && it.k === 'm') grade(chosen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [it, phase, order, chosen, grade, submit, advance, learnNext, summary])

  const top = (
    <header className="bar">
      <button className="icon" onClick={onExit} aria-label="回首頁">
        ‹
      </button>
      <h1>{only ? '錯題練習' : pick?.placement ? `程度測驗 ${PLACEMENT - prog.calib.filter((id) => !prog.items[id]?.first).length + 1}/${PLACEMENT}` : '背題'}</h1>
      <span className="pct">及格 {Math.round(pass * 100)}%</span>
      <Bar value={pass} />
    </header>
  )

  if (summary) return (<>{top}<Placement prog={prog} onGo={() => setSummary(false)} /></>)

  if (!it)
    return (
      <>
        {top}
        <main>
          <div className="card">
            <p>{only ? '錯題都練完了。' : '題目都背過了，可以去做模擬考。'}</p>
          </div>
          <button className="btn primary" onClick={onExit}>
            回首頁
          </button>
        </main>
      </>
    )

  const multi = it.k === 'm'
  const sectionLine = (
    <div className="meta">
      <span className={`tag ${phase === 'learn' ? 'new' : ''}`}>{phase === 'learn' ? '先看答案' : pick?.placement ? '程度測驗' : KIND_LABEL[it.k]}</span>
      <span>{it.s}</span>
      {multi && phase !== 'ask' && <span className="right">{it.a.length} 個答案</span>}
    </div>
  )

  return (
    <>
      {top}
      <main key={it.id + phase}>
        {pick?.placement && phase === 'ask' && <p className="hint">不會就按「不知道」，用猜的也可以。</p>}
        {phase === 'learn' ? (
          <>
            {sectionLine}
            <LearnCard it={it} />
            <button className="btn primary sticky" onClick={learnNext}>
              記住了，下一題
            </button>
          </>
        ) : (
          <>
            {sectionLine}
            <div className="card">
              <p className="stem">{it.q}</p>
              <Figure it={it} />
              {phase === 'ask' ? (
                order.map((k, i) => (
                  <button
                    key={k}
                    className={`opt ${chosen.has(k) ? 'sel' : ''}`}
                    onClick={() => (multi ? setChosen((s) => toggle(s, k)) : grade(new Set([k])))}
                  >
                    <span className="n">{['①', '②', '③', '④'][i]}</span>
                    <span>{it.o[k] || `圖中 ${['①', '②', '③', '④'][k]}`}</span>
                  </button>
                ))
              ) : (
                <Solution it={it} order={order} chosen={chosen} />
              )}
            </div>
            {phase === 'ask' ? (
              <div className="row sticky">
                <button className="btn" onClick={() => submit('unknown', new Set())}>
                  不知道
                </button>
                {multi && (
                  <button className="btn primary" disabled={!chosen.size} onClick={() => grade(chosen)}>
                    確定
                  </button>
                )}
              </div>
            ) : (
              <button className="btn primary sticky" onClick={advance}>
                下一題
              </button>
            )}
          </>
        )}
      </main>
      {flash && <div className="toast">{flash}</div>}
    </>
  )
}

function toggle(s: Set<number>, k: number) {
  const n = new Set(s)
  if (n.has(k)) n.delete(k)
  else n.add(k)
  return n
}
