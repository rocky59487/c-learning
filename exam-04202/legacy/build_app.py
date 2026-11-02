"""Build the app's data bundle.
Usage: python3 -I build_app.py data/questions.json data/triggers.json img/index.json out.json
Each item: [id, kind(0=複選 1=專業單選 2=共同), sec, stem, opts, ans, img, keys{optIndex: token}, twins[ids]]
Items are ordered by the greedy expected-score order from trigger_rules.py.
"""
import json
import re
import sys

Q = [q for q in json.load(open(sys.argv[1], encoding="utf-8")) if not q["deleted"]]
T = json.load(open(sys.argv[2], encoding="utf-8"))
IMG = json.load(open(sys.argv[3], encoding="utf-8"))
byid = {q["id"]: q for q in Q}
N = lambda s: re.sub(r"\s+", "", s)

keys = {q["id"]: {} for q in Q}
order = []
for q in Q:  # 4-answer multi questions first: nothing to memorise but "select all"
    if q["multi"] and len(q["ans"]) == 4:
        order.append(q["id"])
for r in T["rules"]:
    for c in r["ctx"]:
        q = byid[c["id"]]
        for i, o in enumerate(q["opts"]):
            if o and N(o) == N(c["opt"]) and r["token"] in N(o):
                keys[q["id"]].setdefault(i, r["token"])
    for qid in r["solves"]:
        if qid not in order:
            order.append(qid)
VAL = lambda q: (2 * 20 / 180) if q["multi"] else (44 / 578 if q["bank"] == "04202" else 16 / 399)
rest = sorted([q for q in Q if q["id"] not in order], key=lambda q: -VAL(q))
order += [q["id"] for q in rest]
assert len(order) == len(Q)

# confusable "twin" questions: near-identical stems with different answers
def bg(s):
    s = N(s)
    return {s[i:i + 2] for i in range(len(s) - 1)}

B = {q["id"]: bg(q["stem"]) for q in Q}
ans_txt = lambda q: "|".join(q["opts"][int(a) - 1] for a in q["ans"])
twins = {q["id"]: [] for q in Q}
for i, a in enumerate(Q):
    for b in Q[i + 1:]:
        if a["multi"] != b["multi"] or a["bank"] != b["bank"]:
            continue
        x, y = B[a["id"]], B[b["id"]]
        if not x or not y:
            continue
        j = len(x & y) / len(x | y)
        if j >= 0.7 and ans_txt(a) != ans_txt(b):
            twins[a["id"]].append(b["id"])
            twins[b["id"]].append(a["id"])

SEC = {"職業安全衛生": "職業安全衛生", "工作倫理與職業道德": "工作倫理", "環境保護": "環境保護", "節能減碳": "節能減碳"}
items = []
for qid in order:
    q = byid[qid]
    kind = 0 if q["multi"] else (1 if q["bank"] == "04202" else 2)
    sec = q["section"][3:] if q["bank"] == "04202" else SEC[q["bank"]]
    items.append([qid, kind, sec, q["stem"], q["opts"], [int(a) for a in q["ans"]], IMG.get(qid, ""),
                  {str(k): v for k, v in keys[qid].items()}, twins[qid]])
json.dump(items, open(sys.argv[4], "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("items", len(items), "with keys", sum(1 for it in items if it[7]), "with twins", sum(1 for it in items if it[8]))
