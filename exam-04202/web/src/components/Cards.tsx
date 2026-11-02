import type { Item } from '../engine/types'
import { byId, imageOf } from '../data'
import { Marked } from './Marked'

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

/** One line telling what to remember. */
export function Memo({ it }: { it: Item }) {
  if (it.k === 'm') {
    const wrong = it.o.map((_, i) => i).filter((i) => !it.a.includes(i + 1))
    if (!wrong.length) return <p className="memo">這題四個都要選。</p>
    return (
      <p className="memo">
        看到{wrong.map((i) => <b key={i}>「{it.key[i] ?? it.o[i]}」</b>)}就不選，其他都選。
      </p>
    )
  }
  const a = it.a[0] - 1
  const key = it.key[a] ?? it.o[a]
  if (it.sk)
    return (
      <p className="memo">
        題目有<b>「{it.sk}」</b>，選<b>「{key}」</b>。
      </p>
    )
  return (
    <p className="memo">
      看到<b>「{key}」</b>就選。
    </p>
  )
}

function Twins({ it }: { it: Item }) {
  if (!it.tw?.length) return null
  return (
    <>
      {it.tw.slice(0, 2).map((id) => {
        const t = byId.get(id)
        if (!t) return null
        const ans = t.o[t.a[0] - 1]
        return (
          <p className="twin" key={id}>
            <span>很像的題目</span>
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
      <p className="stem small">
        {it.sk ? <Marked text={it.q} mark={it.sk} /> : it.q}
      </p>
      <Figure it={it} />
      {multi ? (
        wrong.length ? (
          <>
            <p className="label bad">不要選</p>
            {wrong.map((i) => (
              <div className="opt bad static" key={i}>
                <span className="n">✗</span>
                <span>
                  <Marked text={it.o[i] || `圖中 ${NUM[i]}`} mark={it.key[i]} />
                </span>
              </div>
            ))}
            <p className="label">其他 {4 - wrong.length} 個都要選</p>
          </>
        ) : (
          <p className="label ok">四個都要選</p>
        )
      ) : (
        <div className="opt ok static big">
          <span className="n">✓</span>
          <span>
            <Marked text={it.o[it.a[0] - 1] || `圖中 ${NUM[it.a[0] - 1]}`} mark={it.key[it.a[0] - 1]} />
          </span>
        </div>
      )}
      {(!multi || wrong.length > 0) && <Memo it={it} />}
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
              <Marked text={it.o[k] || `圖中 ${NUM[k]}`} mark={it.key[k]} />
              {picked && !right && <em className="you">你選的</em>}
              {!picked && right && it.k === 'm' && chosen && <em className="you">漏選</em>}
            </span>
          </div>
        )
      })}
      <Memo it={it} />
      <Twins it={it} />
    </>
  )
}
