"""Build study cards + markdown cheat sheet.
Usage: python3 -I build.py data/questions.json img/index.json data/cards.json 速背清單.md
"""
import json
import re
import sys
from pathlib import Path

Q = [q for q in json.load(open(sys.argv[1], encoding="utf-8")) if not q["deleted"]]
IMG = json.load(open(sys.argv[2], encoding="utf-8"))
NEG = re.compile(r"錯誤|有誤|不正確|不是|不屬|不包括|不需|不宜|不可|不必|非屬|何者非|不適|不能|不得|不應|不會|無關|不合理|較差|不恰當|不符|何者為非|不為|不需要|不一定|無法")

SEC_NAME = {
    "職業安全衛生": "共同‧職業安全衛生",
    "工作倫理與職業道德": "共同‧工作倫理",
    "環境保護": "共同‧環境保護",
    "節能減碳": "共同‧節能減碳",
}

cards = []
for q in Q:
    pro = q["bank"] == "04202"
    tier = 1 if q["multi"] else (2 if pro else 3)
    sec = q["section"][3:] if pro else SEC_NAME[q["bank"]]
    c = {
        "id": q["id"],
        "t": tier,
        "sec": sec,
        "stem": q["stem"],
        "opts": q["opts"],
        "ans": [int(x) for x in q["ans"]],
        "neg": bool(NEG.search(q["stem"])) and not q["multi"],
    }
    if q["id"] in IMG:
        c["img"] = IMG[q["id"]]
    cards.append(c)

Path(sys.argv[3]).write_text(json.dumps(cards, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# ---------- markdown cheat sheet ----------
def opt_txt(c, i):
    t = c["opts"][i - 1]
    return t if t else f"（第{i}個圖/公式）"


lines = [
    "# 04202 工程測量乙級 學科速背清單",
    "",
    "> 正式考試**選項順序會打亂**：背「答案內容」，不要背號碼。",
    "> 有 🖼 的題目答案是圖或公式，請在網頁版看圖。",
    "",
]
order = [(1, "第一優先：複選題（每題 2 分，全對才給分）— 只背 ✗ 錯的選項，其餘全選"),
         (2, "第二優先：專業單選"),
         (3, "第三優先：共同科目單選（多數靠常識）")]
for tier, title in order:
    lines += [f"## {title}", ""]
    cur = None
    for c in [c for c in cards if c["t"] == tier]:
        if c["sec"] != cur:
            cur = c["sec"]
            lines += ["", f"### {cur}", ""]
        img = " 🖼" if c.get("img") else ""
        if tier == 1:
            wrong = [opt_txt(c, i) for i in range(1, 5) if i not in c["ans"]]
            if not wrong:
                tail = "**全對（4 個都選）**"
            else:
                tail = "✗ " + "；✗ ".join(wrong)
            lines.append(f"- {c['stem']}{img} → {tail}")
        else:
            a = c["ans"][0]
            mark = "【選錯的那個】" if c["neg"] else ""
            lines.append(f"- {c['stem']}{img} → {mark}**{opt_txt(c, a)}**")
Path(sys.argv[4]).write_text("\n".join(lines) + "\n", encoding="utf-8")
print("cards", len(cards))
