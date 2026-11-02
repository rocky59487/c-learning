import type { Item } from '../engine/types'
import { byId, imageOf } from '../data'

const NUM = ['①', '②', '③', '④']

export function Figure({ it }: { it: Item }) {
  const src = imageOf(it)
  if (!src) return null
  return (
    <div className="figure">
      <img src={src} alt="題目附圖" />
    </div>
  )
}

/** Explanation of the answer and a short way to remember it. */
export function Explain({ it }: { it: Item }) {
  if (!it.ex && !it.tip) return null
  return (
    <div className="explain">
      {it.ex && (
        <p>
          <b>解析</b>
          {it.ex}
        </p>
      )}
      {it.tip && (
        <p>
          <b>記法</b>
          {it.tip}
        </p>
      )}
    </div>
  )
}

/** Why an option is wrong (multiple choice), shown under the option. */
function Reason({ it, k }: { it: Item; k: number }) {
  const r = it.wx?.[k]
  return r ? <small className="reason">{r}</small> : null
}

function Twins({ it }: { it: Item }) {
  if (!it.tw?.length || it.k === 'm') return null
  return (
    <>
      {it.tw.slice(0, 2).map((id) => {
        const t = byId.get(id)
        if (!t) return null
        const ans = t.o[t.a[0] - 1]
        return (
          <p className="twin" key={id}>
            <span>別搞混</span>
            {t.q.length > 46 ? t.q.slice(0, 46) + '…' : t.q} → <b>{ans || `第 ${t.a[0]} 個`}</b>
          </p>
        )
      })}
    </>
  )
}

/** Answer card shown before a question is asked. */
export function LearnCard({ it }: { it: Item }) {
  const multi = it.k === 'm'
  const wrong = it.o.map((_, i) => i).filter((i) => !it.a.includes(i + 1))
  return (
    <div className="card">
      <p className="stem small">{it.q}</p>
      <Figure it={it} />
      {multi ? (
        <>
          {it.o.map((o, i) => {
            const right = it.a.includes(i + 1)
            return (
              <div className={`opt static ${right ? 'ok' : 'bad'}`} key={i}>
                <span className="n">{right ? '✓' : '✗'}</span>
                <span>
                  {o || `圖中 ${NUM[i]}`}
                  {!right && <Reason it={it} k={i} />}
                </span>
              </div>
            )
          })}
          {!wrong.length && <p className="label ok">四個都要選</p>}
        </>
      ) : (
        <div className="opt ok static big">
          <span className="n">✓</span>
          <span>{it.o[it.a[0] - 1] || `圖中 ${NUM[it.a[0] - 1]}`}</span>
        </div>
      )}
      <Explain it={it} />
      <Twins it={it} />
    </div>
  )
}

/** All options with the right ones marked, in the order they were shown. */
export function Solution({ it, order, chosen }: { it: Item; order: number[]; chosen?: Set<number> }) {
  return (
    <>
      {order.map((k, i) => {
        const right = it.a.includes(k + 1)
        const picked = chosen?.has(k)
        const cls = right ? 'ok' : picked || it.k === 'm' ? 'bad' : 'dim'
        return (
          <div className={`opt static ${cls}`} key={k}>
            <span className="n">{right ? '✓' : it.k === 'm' || picked ? '✗' : NUM[i]}</span>
            <span>
              {it.o[k] || `圖中 ${NUM[k]}`}
              {picked && !right && <em className="you">你選的</em>}
              {!picked && right && it.k === 'm' && chosen && <em className="you">漏選</em>}
              {!right && it.k === 'm' && <Reason it={it} k={k} />}
            </span>
          </div>
        )
      })}
      <Explain it={it} />
      <Twins it={it} />
    </>
  )
}
