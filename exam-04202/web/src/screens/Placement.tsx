import { bank, byId } from '../data'
import { status } from '../engine/scheduler'
import type { Kind, Progress } from '../engine/types'

/** Shown once after the placement questions. */
export function Placement({ prog, onGo }: { prog: Progress; onGo: () => void }) {
  const tally: Record<Kind, [number, number]> = { c: [0, 0], p: [0, 0], m: [0, 0] }
  for (const [id, st] of Object.entries(prog.items)) {
    const it = byId.get(id)
    if (!it || !st.first) continue
    tally[it.k][1]++
    if (st.first === 'right') tally[it.k][0]++
  }
  const s = status(bank, prog)
  const rows: [Kind, string][] = [
    ['c', '共同科目'],
    ['p', '專業單選'],
    ['m', '專業複選'],
  ]
  const common = tally.c[1] ? tally.c[0] / tally.c[1] : 0
  return (
    <main>
      <div className="card">
        <h2>程度測驗結果</h2>
        <table className="tally">
          <tbody>
            {rows.map(([k, name]) => (
              <tr key={k}>
                <td>{name}</td>
                <td>
                  答對 {tally[k][0]} / {tally[k][1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{common >= 0.75 ? '共同科目你多半靠常識就會，會排在後面再看。' : '共同科目也會一起排進來。'}</p>
        <p>接下來先背配分最高、最好記的題目，複選題（一題 2 分）會比較多。</p>
        <p>
          目前及格機率 <b>{Math.round(s.pass * 100)}%</b>
          {s.minutes > 0 && (
            <>
              ，大約背 <b>{s.minutes} 分鐘</b>可以到 80%
            </>
          )}
          。
        </p>
      </div>
      <button className="btn primary" onClick={onGo}>
        開始背題
      </button>
    </main>
  )
}
