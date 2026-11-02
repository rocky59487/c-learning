import { useState } from 'react'
import { bank } from '../data'

export function Settings({ onExit, onReset }: { onExit: () => void; onReset: () => void }) {
  const [sure, setSure] = useState(false)
  const n = (k: string) => bank.items.filter((it) => it.k === k).length
  return (
    <>
      <header className="bar">
        <button className="icon" onClick={onExit} aria-label="回首頁">
          ‹
        </button>
        <h1>設定</h1>
      </header>
      <main>
        <div className="card">
          <h2>題庫</h2>
          <table className="tally">
            <tbody>
              <tr>
                <td>專業單選</td>
                <td>{n('p')} 題</td>
              </tr>
              <tr>
                <td>專業複選</td>
                <td>{n('m')} 題</td>
              </tr>
              <tr>
                <td>共同科目</td>
                <td>{n('c')} 題</td>
              </tr>
            </tbody>
          </table>
          <p className="muted">{bank.meta.source}。已排除公告刪除的題目。</p>
          <p className="muted">
            考試：單選 60 題每題 1 分，複選 20 題每題 2 分（全對才給分），60 分及格。題目排序依每題在考試中可拿的分數與背誦所需時間。
          </p>
        </div>
        <button className={`btn ${sure ? 'danger' : ''}`} onClick={() => (sure ? onReset() : setSure(true))}>
          {sure ? '確定清除，重新開始' : '清除進度'}
        </button>
      </main>
    </>
  )
}
