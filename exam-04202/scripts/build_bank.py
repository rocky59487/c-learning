"""Build the app question bank.

Usage:
  python3 -I build_bank.py data/questions.json data/fixes.json IMG_DIR OUT_DIR

Reads parsed questions, applies the hand-checked transcriptions in fixes.json, computes a memory
key for every answer (single choice) and every wrong option (multiple choice), finds look-alike
questions, and writes OUT_DIR/bank.json plus the figures that are still needed.
"""
import json
import logging
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

import jieba

jieba.setLogLevel(logging.ERROR)
# Traditional Chinese needs jieba's big dictionary:
# https://raw.githubusercontent.com/fxsjy/jieba/master/extra_dict/dict.txt.big
import os
_dict = os.environ.get("JIEBA_DICT", "")
if Path(_dict).exists():
    jieba.set_dictionary(_dict)
for w in Path(__file__).with_name("terms.txt").read_text(encoding="utf-8").split():
    jieba.add_word(w, freq=200000)

src, fixes_path, img_dir, out_dir = sys.argv[1:5]
out_dir = Path(out_dir)
(out_dir / "img").mkdir(parents=True, exist_ok=True)

Q = [q for q in json.load(open(src, encoding="utf-8")) if not q["deleted"]]
FIX = {f["id"]: f for f in json.load(open(fixes_path, encoding="utf-8"))} if Path(fixes_path).exists() else {}

WIDE = r"[⺀-￯]"


def tidy(s):
    s = re.sub(rf"(?<={WIDE}) +(?={WIDE})", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.rstrip("。").strip() if s else s


for q in Q:
    f = FIX.get(q["id"])
    if f:
        q["stem"], q["opts"] = f["stem"], f["opts"]
        q["fig"] = bool(f.get("needs_figure"))
    else:
        q["fig"] = False
    q["stem"] = tidy(q["stem"])
    q["opts"] = [tidy(o) for o in q["opts"]]

# ---------------------------------------------------------------- memory keys
UNIT = re.compile(r"^(m|cm|mm|km|m2|m3|%|°|'|\"|″|′|ppm|kg|秒|分|度|倍|年|日|小時|公尺|公分|公頃|坪|條|個|次|人|元)$")
PUNCT = set("，、。；：（）()「」『』？！,.;:!?·‧/=+-±")
N = lambda s: re.sub(r"\s+", "", s)
_cache = {}


def tokens(s):
    """Candidate memory keys of a text -> {token: rank}; rank 0 = whole option, 1 = one word, 2+ = word span."""
    s = N(s)
    if s in _cache:
        return _cache[s]
    out = {}
    if len(s) <= 14 and re.search(r"\d", s) and len(re.findall(r"[\u4e00-\u9fff]", s)) <= 3:
        out[s] = 0
    else:
        w = [t for t in jieba.lcut(s, HMM=False) if t.strip()]
        g = []
        for t in w:
            if g and re.fullmatch(r"\d+(?:\.\d+)?", g[-1]) and UNIT.match(t):
                g[-1] += t
            else:
                g.append(t)
        for i in range(len(g)):
            for k in (1, 2, 3):
                span = g[i:i + k]
                if len(span) < k or any(ch in PUNCT for t in span for ch in t):
                    continue
                if any(len(t) < 2 for t in span):
                    continue
                t = "".join(span)
                if not re.search(r"[\u4e00-\u9fffA-Za-z]", t):
                    continue
                if 2 <= len(t) <= 10:
                    out[t] = min(out.get(t, 9), k)
        if 0 < len(s) <= 8:
            out[s] = 0
    _cache[s] = out
    return out


def index(qs, want):
    """token -> set of (qid, opt) ; only tokens whose every occurrence has correctness == want."""
    occ = defaultdict(list)
    for q in qs:
        for i, o in enumerate(q["opts"]):
            if o:
                c = str(i + 1) in q["ans"]
                for t in tokens(o):
                    occ[t].append((q["id"], i, c))
    return {t: {(a, b) for a, b, _ in v} for t, v in occ.items() if all(c == want for _, _, c in v)}


singles = [q for q in Q if not q["multi"]]
multis = [q for q in Q if q["multi"]]
PICK = index(singles, True)
DROP = index(multis, False)
by_opt_pick = defaultdict(list)
for t, s in PICK.items():
    for x in s:
        by_opt_pick[x].append(t)
by_opt_drop = defaultdict(list)
for t, s in DROP.items():
    for x in s:
        by_opt_drop[x].append(t)


def best(cands, table, opt):
    # shared by more questions first, then whole words, then shorter
    rank = tokens(opt)
    return max(sorted(cands), key=lambda t: (len(table[t]), -rank.get(t, 9) if rank.get(t, 9) > 0 else -1, -len(t))) if cands else None


def local_key(q, i):
    """Shortest token of option i that no other option of the same question contains."""
    others = [N(o) for k, o in enumerate(q["opts"]) if k != i]
    rank = tokens(q["opts"][i])
    c = [t for t in rank if not any(t in o for o in others)]
    return min(c, key=lambda t: (rank[t] if rank[t] else 1, len(t))) if c else N(q["opts"][i])


# stem tokens for questions whose key is not globally safe
STEM_DF = defaultdict(int)
for q in Q:
    for t in tokens(q["stem"]):
        STEM_DF[t] += 1


STOP = re.compile(r"^(下列|何者|敘述|正確|錯誤|哪些|為何|有關|使用|一般|主要|規定|依據|屬於|可以|應該|所謂|稱為|何種|多少|下列何|是否|以下|其中|如下|如圖|下圖|已知|設有|若有|則其)$")


def stem_words(s):
    return {t for t in jieba.lcut(N(s), HMM=False) if len(t) >= 2 and not any(ch in PUNCT for ch in t) and not STOP.match(t)}


STEM_W = defaultdict(int)
for q in Q:
    for t in stem_words(q["stem"]):
        STEM_W[t] += 1


def stem_key(q):
    c = sorted(t for t in stem_words(q["stem"]) if len(t) <= 8)
    return min(c, key=lambda t: (STEM_W[t], -len(t))) if c else ""


stats = defaultdict(int)
for q in Q:
    q["keys"] = {}
    if q["multi"]:
        for i in range(4):
            if str(i + 1) in q["ans"]:
                continue
            t = best(by_opt_drop.get((q["id"], i), []), DROP, q["opts"][i])
            if t:
                q["keys"][i] = t
                stats["multi_global"] += 1
            else:
                q["keys"][i] = local_key(q, i)
                stats["multi_local"] += 1
    else:
        a = int(q["ans"]) - 1
        t = best(by_opt_pick.get((q["id"], a), []), PICK, q["opts"][a])
        if t:
            q["keys"][a] = t
            stats["single_global"] += 1
        else:
            q["keys"][a] = local_key(q, a)
            q["stemkey"] = stem_key(q)
            stats["single_stem"] += 1

# ---------------------------------------------------------------- look-alike questions
def bg(s):
    s = N(s)
    return {s[i:i + 2] for i in range(len(s) - 1)}


B = {q["id"]: bg(q["stem"]) for q in Q}
ANS = lambda q: "|".join(q["opts"][int(a) - 1] for a in q["ans"])
twins = defaultdict(list)
for i, a in enumerate(singles):
    for b in singles[i + 1:]:
        if a["bank"] != b["bank"] or not B[a["id"]] or not B[b["id"]]:
            continue
        j = len(B[a["id"]] & B[b["id"]]) / len(B[a["id"]] | B[b["id"]])
        if j >= 0.6 and ANS(a) != ANS(b):
            twins[a["id"]].append((j, b["id"]))
            twins[b["id"]].append((j, a["id"]))

# ---------------------------------------------------------------- weights and costs
POOL = defaultdict(list)
SECTIONS = {}
for q in Q:
    if q["bank"] == "04202":
        kind = "m" if q["multi"] else "p"
        sec = q["section"][3:]
    else:
        kind, sec = "c", {"工作倫理與職業道德": "工作倫理"}.get(q["bank"], q["bank"])
    q["kind"], q["sec"] = kind, sec
    POOL[(kind, sec if kind == "c" else "")].append(q)
DRAW = {"p": 44, "m": 20, "c": 4}
PTS = {"p": 1, "m": 2, "c": 1}

items = []
for q in Q:
    pool = POOL[(q["kind"], q["sec"] if q["kind"] == "c" else "")]
    w = PTS[q["kind"]] * DRAW[q["kind"]] / len(pool)
    text = len(N(q["stem"])) + sum(len(N(o)) for o in q["opts"])
    img = ""
    if q["fig"]:
        src_img = Path(img_dir) / f"{q['id']}.png"
        if src_img.exists():
            shutil.copy(src_img, out_dir / "img" / src_img.name)
            img = src_img.name
            stats["figures"] += 1
        else:
            stats["figure_missing"] += 1
    it = {
        "id": q["id"],
        "k": q["kind"],
        "s": q["sec"],
        "q": q["stem"],
        "o": q["opts"],
        "a": [int(x) for x in q["ans"]],
        "w": round(w, 5),
        "n": text,
        "key": {str(k): v for k, v in q["keys"].items()},
    }
    if q.get("stemkey"):
        it["sk"] = q["stemkey"]
    if img:
        it["img"] = img
    tw = [b for _, b in sorted(twins[q["id"]], reverse=True)[:2]]
    if tw:
        it["tw"] = tw
    items.append(it)

meta = {
    "code": "04202",
    "name": "工程測量乙級",
    "exam": {"single": 60, "multi": 20, "pass": 60, "draw": DRAW},
    "sections": sorted({(i["k"], i["s"]) for i in items}),
    "source": "勞動部勞動力發展署技能檢定中心 04202 學科題庫（A11）與共同科目 90006–90009",
}
json.dump({"meta": meta, "items": items}, open(out_dir / "bank.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(dict(stats), "items", len(items), "twins", sum(1 for i in items if "tw" in i))
