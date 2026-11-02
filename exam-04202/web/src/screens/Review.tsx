import { useMemo, useState } from 'react'
import { bank } from '../data'
import { probabilities } from '../engine/scheduler'
import type { Item, Progress } from '../engine/types'
import { Explain } from '../components/Cards'

function answerText(it: Item): string {
  if (it.k !== 'm') return '答：' + (it.o[it.a[0] - 1] || `第 ${it.a[0]} 個`)
  const wrong = it.o.filter((_, i) => !it.a.includes(i + 1))
  return wrong.length ? '不要選：' + wrong.join('；') : '四個都選'
}

/** Everything studied so far, weakest first, as a quick list to read before the exam. */
export function Review({ prog, onExit, onPractice }: { prog: Progress; onExit: () => void; onPractice: (ids: string[]) => void }) {
  const [onlyWrong, setOnlyWrong] = useState(false)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const probs = useMemo(() => probabilities(bank, prog), [prog])
  const all = useMemo(
    () =>
      bank.items
        .filter((it) => {
          const st = prog.items[it.id]
          return st && (st.seen > 0 || st.wrongAt !== undefined)
        })
        .sort((a, b) => probs.get(a.id)! - probs.get(b.id)!),
    [prog, probs],
  )
  const wrongIds = all.filter((it) => prog.items[it.id].wrongAt !== undefined && !prog.items[it.id].done).map((it) => it.id)
  const list = all.filter(
    (it) => (!onlyWrong || wrongIds.includes(it.id)) && (!q || it.q.includes(q) || it.o.some((o) => o.includes(q))),
  )
  return (
    <>
      <header className="bar">
        <button className="icon" onClick={onExit} aria-label="回首頁">
          ‹
        </button>
        <h1>考前複習</h1>
        <span className="pct">{all.length} 題</span>
      </header>
      <main>
        <div className="card tips">
          <h2>考場上</h2>
          <ul>
            <li>複選題沒把握：選 3 個，刪掉最不像的那一個。題庫裡沒有只有 1 個答案的複選題。</li>
            <li>單選題問「錯誤」：只有一個選項出現「一定、必須、只要、完全、均」或「不、非、無」時，選它，大約一半會對。</li>
            <li>每一題都要作答，不倒扣。</li>
          </ul>
        </div>
        {all.length ? (
          <>
            <div className="seg" role="tablist">
              <button role="tab" aria-selected={!onlyWrong} onClick={() => setOnlyWrong(false)}>
                全部
              </button>
              <button role="tab" aria-selected={onlyWrong} onClick={() => setOnlyWrong(true)}>
                還沒記熟 {wrongIds.length}
              </button>
            </div>
            <input className="search" type="search" placeholder="搜尋題目或選項" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜尋" />
            {onlyWrong && wrongIds.length > 0 && (
              <button className="btn primary" onClick={() => onPractice(wrongIds)}>
                重練這 {wrongIds.length} 題
              </button>
            )}
            <ul className="review">
              {list.slice(0, limit).map((it) => (
                <li key={it.id}>
                  <p className="stem small">{it.q}</p>
                  <p className="answer">{answerText(it)}</p>
                  <Explain it={it} />
                </li>
              ))}
            </ul>
            {list.length > limit && (
              <button className="btn" onClick={() => setLimit(limit + 60)}>
                再顯示 60 題
              </button>
            )}
          </>
        ) : (
          <div className="card">
            <p>還沒有背過的題目。先去背題，這裡會整理你看過的重點。</p>
          </div>
        )}
      </main>
    </>
  )
}
