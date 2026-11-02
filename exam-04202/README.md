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
