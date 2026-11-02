# 04202 工程測量乙級學科

- `web/`：背題網站（React + TypeScript + Vite，可安裝成手機 App、離線可用）。建置與部署見 `web/README.md`。
- `ANALYSIS.md`：題庫分析、選項規律檢定、背題引擎與模擬結果。
- `data/`：解析後的題目（`questions.json`）、圖片題的人工轉寫（`fixes.json`）、分析輸出。
- `raw/`：題庫 PDF 轉出的文字。
- `scripts/`：資料處理與分析程式。
- `legacy/`：早期版本。

## 重新產生題庫資料

```bash
pip install jieba pillow scikit-learn scipy
# jieba 繁體字典：https://raw.githubusercontent.com/fxsjy/jieba/master/extra_dict/dict.txt.big
export JIEBA_DICT=/path/to/dict.txt.big
python3 -I scripts/parse.py raw data/questions.json
python3 -I scripts/build_bank.py data/questions.json data/fixes.json <高解析截圖資料夾> web/src/data/04202
python3 -I scripts/shrink_img.py web/src/data/04202/img
```

`<高解析截圖資料夾>` 由 `scripts/crop.py` 以 220 dpi 從題庫 PDF 截出，只有需要附圖的題目會被複製。

## 分析

```bash
python3 -I scripts/analyze.py data/questions.json       # 答案位置、長度等統計
python3 -I scripts/rule_tests.py data/questions.json    # 單一規則的二項檢定
python3 -I scripts/pattern_model.py data/questions.json # 交叉驗證模型
cd web && npx tsx scripts/simulate.ts                   # 學習模擬
```
