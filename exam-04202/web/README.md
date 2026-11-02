# 工程測量乙級學科 — 背題網站

React + TypeScript + Vite。純前端，進度存在瀏覽器（localStorage），不需要後端。

## 開發

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 引擎單元測試
npx tsx scripts/simulate.ts   # 模擬不同學生的及格機率
```

## 建置

```bash
npm run build          # dist/：可安裝的 PWA（離線可用、可加到主畫面）
npm run build:single   # dist-single/index.html：單一檔案版本
```

`dist/` 是一般靜態網站，放到任何靜態主機即可：

- **Cloudflare Pages / Netlify / Vercel**：建置指令 `npm run build`，輸出資料夾 `dist`。
- **GitHub Pages**：把 `dist/` 推到 `gh-pages` 分支，或用 GitHub Actions 部署。`vite.config.ts` 的 `base` 是 `./`，放在子路徑也能用。

Android 手機用 Chrome 打開網站，選「加到主畫面」就會像 App 一樣全螢幕開啟，第一次載入後可離線使用。

## 結構

```
src/
  engine/        背題引擎（與畫面無關，可單獨測試）
    model.ts       知識追蹤、能力估計、及格機率、時間估計
    scheduler.ts   選下一題、記錄作答、程度測驗、預估所需時間
  screens/       首頁、背題、程度測驗結果、模擬考、考前複習、設定
  components/    題目卡、答案卡、重點標示
  data/04202/    題庫（bank.json）與附圖
scripts/
  simulate.ts    用同一套引擎模擬學生，比較排題方式
```

## 題庫資料

`src/data/04202/bank.json` 由 `../scripts/build_bank.py` 產生，來源是勞動部技能檢定中心公告的題庫 PDF。
每題欄位：

| 欄位 | 說明 |
|---|---|
| `k` | `p` 專業單選、`m` 專業複選、`c` 共同科目 |
| `s` | 工作項目或共同科目名稱 |
| `q` / `o` / `a` | 題目、四個選項、正確選項（從 1 起算） |
| `w` | 這題在一次考試中平均值幾分（配分 × 抽中機率） |
| `key` | 選項的記憶重點：單選是正確答案中「全題庫只會出現在正確答案」的字詞；複選是錯誤選項中「全題庫只會出現在錯誤選項」的字詞 |
| `sk` | 答案重點不是全題庫唯一時，用來辨認題目的關鍵字 |
| `tw` | 題目很像但答案不同的題目 |
| `img` | 需要看圖才能作答的附圖 |

新增其他職類：照同樣格式產生 `src/data/<代號>/bank.json`，改 `src/data.ts` 的匯入路徑即可。
