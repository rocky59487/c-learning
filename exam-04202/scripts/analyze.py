"""Statistical analysis of answer patterns. Usage: python3 -I analyze.py data/questions.json"""
import json
import re
import sys
from collections import Counter, defaultdict

Q = [q for q in json.load(open(sys.argv[1], encoding="utf-8")) if not q["deleted"]]


def pct(a, b):
    return f"{a}/{b} = {100*a/b:.1f}%" if b else "-"


def num(s):
    m = re.search(r"-?\d+(?:\.\d+)?", s.replace(",", ""))
    return float(m.group()) if m else None


def bigrams(s):
    s = re.sub(r"\s", "", s)
    return {s[i : i + 2] for i in range(len(s) - 1)}


groups = {
    "專業-單選": [q for q in Q if q["bank"] == "04202" and not q["multi"]],
    "專業-複選": [q for q in Q if q["bank"] == "04202" and q["multi"]],
    "共同-單選": [q for q in Q if q["bank"] != "04202"],
}
for g, qs in groups.items():
    print(f"\n===== {g}: {len(qs)} 題 =====")
    if g.endswith("單選"):
        c = Counter(q["ans"] for q in qs)
        print("答案位置分布:", dict(sorted(c.items())))
        ok = [q for q in qs if all(q["opts"])]
        # heuristics
        res = defaultdict(lambda: [0, 0])
        for q in ok:
            o = q["opts"]
            a = int(q["ans"]) - 1
            L = [len(x) for x in o]
            numeric = all(num(x) is not None and len(re.sub(r"[\d\.\-+°'\"′″ ,±a-zA-Z²³/%：:]", "", x)) <= 2 for x in o)
            neg = bool(re.search(r"錯誤|有誤|不正確|不是|不屬|不包括|不需|不宜|不可|不必|非屬|何者非|不適|不能|不得|不應|不會|無關|不合理|較差|不恰當|不符", q["stem"]))
            if not numeric:
                mx = max(L)
                if L.count(mx) == 1:
                    res["最長選項(文字題)"][0] += L.index(mx) == a
                    res["最長選項(文字題)"][1] += 1
                    key = "最長選項|否定題" if neg else "最長選項|肯定題"
                    res[key][0] += L.index(mx) == a
                    res[key][1] += 1
                mn = min(L)
                if L.count(mn) == 1:
                    res["最短選項(文字題)"][0] += L.index(mn) == a
                    res["最短選項(文字題)"][1] += 1
                # most similar to the other options
                B = [bigrams(x) for x in o]
                sim = [sum(len(B[i] & B[j]) / (len(B[i] | B[j]) or 1) for j in range(4) if j != i) for i in range(4)]
                best = max(range(4), key=lambda i: sim[i])
                res["與其他選項最相似"][0] += best == a
                res["與其他選項最相似"][1] += 1
                # option text appears (bigram overlap) in stem
                st = bigrams(q["stem"])
                ov = [len(B[i] & st) / (len(B[i]) or 1) for i in range(4)]
                best = max(range(4), key=lambda i: ov[i])
                if ov.count(ov[best]) == 1:
                    res["與題幹重疊最多"][0] += best == a
                    res["與題幹重疊最多"][1] += 1
                lw = [i for i in range(4) if "以上皆" in o[i] or "以上都" in o[i]]
                if lw:
                    res["有「以上皆是/以上皆非」→選它"][0] += lw[0] == a
                    res["有「以上皆是/以上皆非」→選它"][1] += 1
            else:
                vals = [num(x) for x in o]
                order = sorted(range(4), key=lambda i: vals[i])
                rank = order.index(a)
                res[f"數字題:答案是第{rank+1}小"][0] += 1
                res["數字題總數"][1] += 1
                res["數字題總數"][0] += 1
                mid = rank in (1, 2)
                res["數字題:選中間兩個之一"][0] += mid
                res["數字題:選中間兩個之一"][1] += 1
                # value that is "related" to most others (x2, /2, x10, same digits)
                def digits(v):
                    return re.sub(r"[^\d]", "", f"{v}").strip("0")
                D = [digits(v) for v in vals]
                same = [sum(D[i] == D[j] for j in range(4) if j != i) for i in range(4)]
                if max(same) > 0 and same.count(max(same)) < 4:
                    cands = [i for i in range(4) if same[i] == max(same)]
                    res["數字題:數字串跟別的選項相同者(位數陷阱)"][0] += a in cands
                    res["數字題:數字串跟別的選項相同者(位數陷阱)"][1] += 1
        for k, (a, b) in sorted(res.items()):
            if k.startswith("數字題:答案是第"):
                print(f"  {k}: {a}題")
            else:
                print(f"  {k}: {pct(a, b)}")
    else:
        c = Counter(len(q["ans"]) for q in qs)
        print("正確選項個數分布:", dict(sorted(c.items())))
        c2 = Counter(q["ans"] for q in qs)
        print("答案組合 top:", c2.most_common(12))
        pos = Counter()
        for q in qs:
            for ch in q["ans"]:
                pos[ch] += 1
        print("各位置為正確的比例:", {k: f"{v}/{len(qs)}" for k, v in sorted(pos.items())})
        # per-option feature analysis
        feats = {
            "絕對詞(均/皆/一定/必須/只要/完全/無須/唯一/僅/所有/即可/不會/無法/絕對/任何)": r"均|皆|一定|必須|只要|完全|無須|無需|唯一|僅|所有|即可|不會|無法|絕對|任何|永遠|全部|只有|只需|只能|才能|不必|不需",
            "可/可以/可能/通常/一般/較/越": r"可以|可能|通常|一般|較|越|愈|可",
            "消除": r"消除",
            "減少/降低/減弱": r"減少|降低|減弱|減小",
            "提高/增加": r"提高|增加|提升",
            "無關/不影響": r"無關|不影響|不受|沒有影響|無影響",
        }
        tot = [0, 0]
        stat = {k: [0, 0] for k in feats}
        lens = defaultdict(lambda: [0, 0])
        for q in qs:
            if not all(q["opts"]):
                continue
            L = [len(x) for x in q["opts"]]
            srt = sorted(range(4), key=lambda i: L[i])
            for i, o in enumerate(q["opts"]):
                t = str(i + 1) in q["ans"]
                tot[0] += t
                tot[1] += 1
                for k, rx in feats.items():
                    if re.search(rx, o):
                        stat[k][0] += t
                        stat[k][1] += 1
                lens[srt.index(i)][0] += t
                lens[srt.index(i)][1] += 1
        print("  任一選項為正確的基準率:", pct(*tot))
        for k, (a, b) in stat.items():
            print(f"  含「{k}」的選項為正確: {pct(a, b)}")
        for r in range(4):
            print(f"  長度排名第{r+1}短的選項為正確: {pct(*lens[r])}")
        # the "most frequent count" strategy
