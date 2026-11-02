"""Experiment B: compress the whole bank into the fewest "see X -> pick / drop" trigger strings.

Single choice: a PICK token t is valid iff every single-choice option in the bank that contains t
is that question's answer.  Seeing t in an option => choose it (no need to read the stem).
Multiple choice (strategy: select everything except recognised wrong options): a DROP token t is
valid iff every multi-choice option containing t is a wrong option.  A multi question is solved when
all its wrong options are covered.

Greedy by expected exam points per token:
  multi question solved   = 2 pts * 20/180 (drawn) ...  computed from bank sizes
  professional single     = 1 pt * 44/578
  common single           = 1 pt * 16/399
Usage: python3 -I trigger_rules.py data/questions.json data/triggers.json
"""
import heapq
import json
import re
import sys
from collections import defaultdict

Q = [q for q in json.load(open(sys.argv[1], encoding="utf-8")) if not q["deleted"]]
NORM = lambda s: re.sub(r"\s+", "", s)

pro_s = [q for q in Q if q["bank"] == "04202" and not q["multi"]]
com_s = [q for q in Q if q["bank"] != "04202"]
mul = [q for q in Q if q["multi"]]
VAL = {}
for q in pro_s:
    VAL[q["id"]] = 44 / len(pro_s)
for q in com_s:
    VAL[q["id"]] = 16 / len(com_s)
for q in mul:
    VAL[q["id"]] = 2 * 20 / len(mul)

NUMCH = set("0123456789.")


import logging
import jieba
jieba.setLogLevel(logging.ERROR)
UNIT = re.compile(r"^(m|cm|mm|km|m2|m3|%|°|'|\"|″|′|ppm|kg|秒|分|度|倍|年|日|小時|公尺|公分|公頃|坪|條|個|次|人|元)$")
PUNCT = set("，、。；：（）()「」『』？！,.;:!?·‧/=+-±")


def words(s):
    w = [t for t in jieba.lcut(s) if t.strip()]
    out = []
    for t in w:  # glue a number to its unit: 42.3 + m -> 42.3m
        if out and re.fullmatch(r"\d+(?:\.\d+)?", out[-1]) and UNIT.match(t):
            out[-1] += t
        else:
            out.append(t)
    return out


_cache = {}


def substrings(s, maxw=3):
    if s in _cache:
        return _cache[s]
    # numeric answers (e.g. 5°09'00", 1/7, ±3.1cm): the whole option is the trigger, never a cut-off piece
    if len(s) <= 14 and re.search(r"\d", s) and len(re.findall(r"[\u4e00-\u9fff]", s)) <= 3:
        _cache[s] = {s}
        return _cache[s]
    w = words(s)
    out = set()
    for i in range(len(w)):
        for k in range(1, maxw + 1):
            span = w[i:i + k]
            if len(span) < k:
                break
            if span[0] in PUNCT or span[-1] in PUNCT:
                continue
            t = "".join(span)
            if 2 <= len(t) <= 10:
                out.add(t)
    _cache[s] = out
    return out


def build(qs, want_correct):
    """index token -> set(question ids it decides); tokens valid only if every option containing them
    has correctness == want_correct."""
    tok_opts = defaultdict(list)  # token -> list of (qid, opt_index, is_correct)
    for q in qs:
        for i, o in enumerate(q["opts"]):
            if not o:
                continue
            c = str(i + 1) in q["ans"]
            for t in substrings(NORM(o)):
                tok_opts[t].append((q["id"], i, c))
    valid = {}
    for t, lst in tok_opts.items():
        if all(c == want_correct for _, _, c in lst):
            valid[t] = {(qid, i) for qid, i, _ in lst}
    return valid


pick = build(pro_s + com_s, True)  # single choice pick-tokens
drop = build(mul, False)  # multi choice drop-tokens

# what each question needs
need = {}
for q in pro_s + com_s:
    a = int(q["ans"]) - 1
    if q["opts"][a]:
        need[q["id"]] = {(q["id"], a)}
for q in mul:
    wrong = {(q["id"], i) for i in range(4) if str(i + 1) not in q["ans"]}
    if all(q["opts"][i] for _, i in wrong):
        need[q["id"]] = wrong  # empty set => all 4 correct, solved for free
unsolvable = [q["id"] for q in Q if q["id"] not in need]

cands = {}
for t, s in pick.items():
    cands[("選", t)] = s
for t, s in drop.items():
    cands[("不選", t)] = s

covered = set()
solved = {qid for qid, n in need.items() if not n}  # 4-correct multi questions
qopts = defaultdict(set)
for qid, n in need.items():
    for x in n:
        qopts[x].add(qid)


def gain(key):
    s = cands[key]
    g = 0.0
    touched = {qid for (qid, _) in s if qid in need and qid not in solved}
    for qid in touched:
        n = need[qid]
        newcov = (n & s) - covered
        if not newcov:
            continue
        rem = n - covered
        # credit proportional to share of the remaining requirement; full value when it completes the question
        g += VAL[qid] * len(newcov) / len(n)
    # prefer short tokens a little
    return g


heap = [(-gain(k), len(k[1]), k) for k in cands]
heapq.heapify(heap)
chosen = []
while heap:
    g, L, k = heapq.heappop(heap)
    g2 = gain(k)
    if g2 <= 1e-9:
        continue
    if heap and -g2 > heap[0][0] + 1e-12:
        heapq.heappush(heap, (-g2, L, k))
        continue
    newly = (cands[k] - covered) & set().union(*[need[q] for q in {qid for qid, _ in cands[k]} if q in need])
    covered |= newly
    done = []
    for qid in {qid for qid, _ in newly}:
        if need[qid] <= covered and qid not in solved:
            solved.add(qid)
            done.append(qid)
    chosen.append({"rule": k[0], "token": k[1], "covers_opts": len(newly), "solves": done})

# expected exam score curve
def score(solved_set):
    s_pro = sum(1 for q in pro_s if q["id"] in solved_set) / len(pro_s)
    s_com = sum(1 for q in com_s if q["id"] in solved_set) / len(com_s)
    s_mul = sum(1 for q in mul if q["id"] in solved_set) / len(mul)
    return 44 * (s_pro + (1 - s_pro) * 0.25) + 16 * (s_com + (1 - s_com) * 0.25) + 40 * (s_mul + (1 - s_mul) * 0.13)


base_solved = {qid for qid, n in need.items() if not n}
print("可用的「看到就選」字串(單選):", len(pick), " 「看到就不選」字串(複選):", len(drop))
print("無法用文字規則的題(答案是圖/公式):", len(unsolvable))
print("選出的規則數:", len(chosen))
cum = set(base_solved)
curve = []
for i, c in enumerate(chosen, 1):
    cum |= set(c["solves"])
    c["cum_score"] = round(score(cum), 2)
    if i in (25, 50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1200) or i == len(chosen):
        curve.append((i, c["cum_score"]))
print("0 條規則(全部亂猜)的期望分數:", round(score(base_solved), 2))
for i, s in curve:
    print(f"  背前 {i:4d} 條 → 期望 {s:5.1f} 分")
first60 = next((i for i, c in enumerate(chosen, 1) if c["cum_score"] >= 60), None)
print("期望分數到 60 分需要的規則數:", first60)
multi_tokens = sum(1 for c in chosen if c["rule"] == "不選")
print("其中複選「不選」規則:", multi_tokens)
# how many rules solve more than one question (real shared patterns)
shared = [c for c in chosen if len(c["solves"]) + 0 > 1 or c["covers_opts"] > 1]
print("一條規則同時搞定 ≥2 題/選項的:", len(shared))
for c in sorted(shared, key=lambda c: -c["covers_opts"])[:40]:
    print("   ", c["rule"], repr(c["token"]), "覆蓋選項", c["covers_opts"], "解掉", len(c["solves"]))

# attach context for the study list
OPT = {}
for q in Q:
    for i, o in enumerate(q["opts"]):
        OPT[(q["id"], i)] = (q, o)
for c in chosen:
    k = (c["rule"], c["token"])
    ctx = []
    for (qid, i) in sorted(cands[k]):
        q, o = OPT[(qid, i)]
        ctx.append({"id": qid, "opt": o, "stem": q["stem"][:60]})
    c["ctx"] = ctx
json.dump({"rules": chosen, "unsolvable": unsolvable}, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=0)
