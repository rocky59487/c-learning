"""Merge explanation batches into data/explain.json and report problems.

Usage: python3 -I merge_explain.py OUT_JSON BATCH.json [BATCH.json ...]
Existing entries in OUT_JSON are kept unless a batch provides the same id.
"""
import json
import re
import sys
from pathlib import Path

out = Path(sys.argv[1])
bank = {q["id"]: q for q in json.load(open("data/questions.json", encoding="utf-8")) if not q["deleted"]}
merged = {e["id"]: e for e in json.load(open(out, encoding="utf-8"))} if out.exists() else {}
problems = []
for path in sys.argv[2:]:
    try:
        batch = json.load(open(path, encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        problems.append(f"{path}: unreadable ({e})")
        continue
    for e in batch:
        q = bank.get(e.get("id"))
        if not q:
            problems.append(f"{path}: unknown id {e.get('id')}")
            continue
        ex = (e.get("ex") or "").strip()
        tip = (e.get("tip") or "").strip()
        wx = {str(k): str(v).strip() for k, v in (e.get("wx") or {}).items() if str(v).strip()}
        if not ex:
            problems.append(f"{e['id']}: empty ex")
        if re.search(r"[①②③④]|選項\s*[1-4一二三四]", ex + tip):
            problems.append(f"{e['id']}: mentions option number")
        if q["multi"]:
            wrong = {str(i + 1) for i in range(4) if str(i + 1) not in q["ans"]}
            if wrong - set(wx):
                problems.append(f"{e['id']}: missing wx for {sorted(wrong - set(wx))}")
            wx = {k: v for k, v in wx.items() if k in wrong}
        else:
            wx = {}
        merged[e["id"]] = {"id": e["id"], "ex": ex, "tip": tip, "wx": wx, "doubt": (e.get("doubt") or "").strip()}
json.dump(sorted(merged.values(), key=lambda e: e["id"]), open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(merged)} / {len(bank)} explained, {sum(1 for e in merged.values() if e['doubt'])} with doubts")
for p in problems[:40]:
    print("  -", p)
