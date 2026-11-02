# 04202 工程測量乙級 學科速背

- `04202速背.html`：手機用速背／測驗頁（離線可開）
- `速背清單.md`：純文字版清單（複選只列 ✗ 錯的選項）
- `data/questions.json`：解析後的全部題目與官方答案
- `scripts/`：parse → analyze → crop → build → assemble
- `raw/`：題庫 PDF 轉出的文字

重新產生：
```
python3 -I scripts/parse.py raw data/questions.json
python3 -I scripts/analyze.py data/questions.json
python3 -I scripts/build.py data/questions.json img/index.json data/cards.json 速背清單.md
python3 -I scripts/assemble.py scripts/page.template.html data/cards.json img 04202速背.html
```

## 背題 App
- `背題App.html`：單檔版，手機瀏覽器直接開。
- `app/pwa/`：可安裝版（PWA）。放到任何 HTTPS 靜態主機（例如 GitHub Pages）後，用 Android Chrome 開啟 →「加到主畫面」，就會像 App 一樣全螢幕、離線可用。
- 重新產生：
```
python3 -I scripts/build_app.py data/questions.json data/triggers.json img/index.json data/app_items.json
python3 -I scripts/assemble_app.py app/template.html data/app_items.json img data/triggers.json 背題App.html
python3 -I scripts/assemble_app.py app/template.html data/app_items.json img data/triggers.json app/pwa/index.html --pwa
```
