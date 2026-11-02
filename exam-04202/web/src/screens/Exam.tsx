import { useMemo, useState } from 'react'
import { bank } from '../data'
import { pools } from '../engine/model'
import { examAnswer, shuffle } from '../engine/scheduler'
import type { Item, Progress } from '../engine/types'
import { Figure, Solution } from '../components/Cards'

interface Q {
  it: Item
  order: number[]
  sel: Set<number>
}

const NUM = ['①', '②', '③', '④']

function draw(): Q[] {
  const singles: Item[] = []
  const multis: Item[] = []
  for (const pool of pools(bank)) {
    const picked = shuffle(pool.items).slice(0, pool.draw)
    if (pool.items[0].k === 'm') multis.push(...picked)
    else singles.push(...picked)
  }
  return [...shuffle(singles), ...multis].map((it) => ({ it, order: it.img ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]), sel: new Set<number>() }))
}

const isRight = (q: Q) => q.sel.size === q.it.a.length && q.it.a.every((a) => q.sel.has(a - 1))

export function Exam({ prog, touch, onExit }: { prog: Progress; touch: () => void; onExit: () => void }) {
  const qs = useMemo(draw, [])
  const [i, setI] = useState(0)
  const [, force] = useState(0)
  const [done, setDone] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const q = qs[i]
  const multi = q.it.k === 'm'
  const answered = qs.filter((x) => x.sel.size).length

  const choose = (k: number) => {
    if (done) return
    if (multi) {
      if (q.sel.has(k)) q.sel.delete(k)
      else q.sel.add(k)
      force((n) => n + 1)
    } else {
      q.sel = new Set([k])
      if (i < qs.length - 1) setI(i + 1)
      else force((n) => n + 1)
    }
  }

  const finish = () => {
    for (const x of qs) if (x.sel.size) examAnswer(bank, prog, x.it.id, isRight(x) ? 'right' : 'wrong')
    touch()
    setDone(true)
    setShowResult(true)
  }

  if (showResult) {
    const score = qs.reduce((s, x) => s + (isRight(x) ? (x.it.k === 'm' ? 2 : 1) : 0), 0)
    const single = qs.filter((x) => x.it.k !== 'm')
    const mul = qs.filter((x) => x.it.k === 'm')
    return (
      <>
        <header className="bar">
          <button className="icon" onClick={onExit} aria-label="回首頁">
            ‹
          </button>
          <h1>模擬考成績</h1>
        </header>
        <main>
          <div className="card">
            <div className="kpi">
              <div>
                <span className="muted">分數</span>
                <b className={score >= 60 ? 'good' : 'bad'}>{score}</b>
              </div>
              <div>
                <span className="muted">結果</span>
                <b className={score >= 60 ? 'good' : 'bad'}>{score >= 60 ? '及格' : '未及格'}</b>
              </div>
            </div>
            <table className="tally">
              <tbody>
                <tr>
                  <td>單選（1 分）</td>
                  <td>
                    {single.filter(isRight).length} / {single.length}
                  </td>
                </tr>
                <tr>
                  <td>複選（2 分）</td>
                  <td>
                    {mul.filter(isRight).length} / {mul.length}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="muted">答錯的題目會回到背題裡再練一次。</p>
          </div>
          <button
            className="btn primary"
            onClick={() => {
              setI(qs.findIndex((x) => !isRight(x)) >= 0 ? qs.findIndex((x) => !isRight(x)) : 0)
              setShowResult(false)
            }}
          >
            看答錯的題目
          </button>
          <button className="btn" onClick={onExit}>
            回首頁
          </button>
        </main>
      </>
    )
  }

  return (
    <>
      <header className="bar">
        <button className="icon" onClick={onExit} aria-label="離開">
          ‹
        </button>
        <h1>{done ? '檢討' : '模擬考'}</h1>
        <span className="pct">
          {i + 1} / {qs.length}
        </span>
      </header>
      <main key={i}>
        <div className="meta">
          <span className="tag">{multi ? '複選 2 分' : '單選 1 分'}</span>
          {done && <span>{q.it.s}</span>}
        </div>
        <div className="card">
          <p className="stem">{q.it.q}</p>
          <Figure it={q.it} />
          {done ? (
            <Solution it={q.it} order={q.order} chosen={q.sel} />
          ) : (
            q.order.map((k, n) => (
              <button key={k} className={`opt ${q.sel.has(k) ? 'sel' : ''}`} onClick={() => choose(k)}>
                <span className="n">{NUM[n]}</span>
                <span>{q.it.o[k] || `圖中 ${NUM[k]}`}</span>
              </button>
            ))
          )}
        </div>
        <div className="row">
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
            上一題
          </button>
          <button className="btn" disabled={i === qs.length - 1} onClick={() => setI(i + 1)}>
            下一題
          </button>
        </div>
        {!done ? (
          <button className="btn primary" onClick={() => (answered < qs.length && !confirm ? setConfirm(true) : finish())}>
            {confirm && answered < qs.length ? `還有 ${qs.length - answered} 題沒寫，確定交卷` : `交卷（已作答 ${answered} 題）`}
          </button>
        ) : (
          <button className="btn primary" onClick={() => setShowResult(true)}>
            回到成績
          </button>
        )}
        <div className="palette">
          {qs.map((x, n) => (
            <button
              key={n}
              className={[n === i ? 'cur' : '', done ? (isRight(x) ? 'ok' : 'bad') : x.sel.size ? 'on' : ''].join(' ')}
              onClick={() => setI(n)}
            >
              {n + 1}
            </button>
          ))}
        </div>
      </main>
    </>
  )
}

