import { useMemo } from 'react'
import { bank } from '../data'
import { status } from '../engine/scheduler'
import type { Progress } from '../engine/types'

export function Home({ prog, go }: { prog: Progress; go: (v: 'study' | 'exam' | 'review' | 'settings') => void }) {
  const s = useMemo(() => status(bank, prog), [prog, prog.step]) // eslint-disable-line react-hooks/exhaustive-deps
  const fresh = !Object.keys(prog.items).length
  const learned = Object.values(prog.items).filter((x) => x.done).length
  const studied = Object.values(prog.items).filter((x) => x.seen > 0 || x.done).length
  const pct = Math.round(s.pass * 100)
  return (
    <>
      <header className="bar">
        <h1>{bank.meta.name}學科</h1>
        <button className="icon" onClick={() => go('settings')} aria-label="設定">
          ⋯
        </button>
      </header>
      <main>
        {fresh ? (
          <div className="card">
            <h2>開始之前</h2>
            <p>先做 12 題程度測驗，之後依你的程度，從最容易拿分的題目開始背。</p>
            <p className="muted">題目全部出自官方題庫。考試時選項順序會打亂，請記答案的內容，不要記號碼。</p>
          </div>
        ) : (
          <div className="card">
            <div className="kpi">
              <div>
                <span className="muted">及格機率</span>
                <b className={pct >= 80 ? 'good' : ''}>{pct}%</b>
              </div>
              <div>
                <span className="muted">預估分數</span>
                <b>{Math.round(s.mean)}</b>
              </div>
            </div>
            <div className="meter">
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="muted">
              {s.minutes > 0 ? `照你目前的速度，再背約 ${s.minutes} 分鐘可以到 80%。` : '已經到 80% 了，去做一次模擬考確認。'}
              已看過 {studied} 題，熟練 {learned} 題。
            </p>
          </div>
        )}
        <button className="btn primary" onClick={() => go('study')}>
          {fresh ? '開始程度測驗' : '繼續背題'}
        </button>
        {!fresh && (
          <div className="row">
            <button className="btn" onClick={() => go('exam')}>
              模擬考
            </button>
            <button className="btn" onClick={() => go('review')}>
              考前複習
            </button>
          </div>
        )}
      </main>
    </>
  )
}
