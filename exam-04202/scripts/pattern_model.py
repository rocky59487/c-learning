"""Experiment A: is there a pattern that generalises to UNSEEN questions?

Option-level features (relative to the other 3 options) + optional char n-grams,
L1 logistic regression, 5-fold grouped CV by question. Prediction = argmax per question.
Usage: python3 -I pattern_model.py data/questions.json
"""
import json
import re
import sys
from collections import Counter

import numpy as np
from scipy.sparse import hstack, csr_matrix
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression

rng = np.random.default_rng(0)
Q = [q for q in json.load(open(sys.argv[1], encoding="utf-8")) if not q["deleted"] and all(q["opts"])]
NEG = re.compile(r"錯誤|有誤|不正確|不是|不屬|不包括|不需|不宜|不可|不必|非屬|何者非|不適|不能|不得|不應|不會|無關|不合理|較差|不恰當|不符|何者為非|不為")
ABS = re.compile(r"均|皆|一定|必須|只要|完全|無須|無需|唯一|僅|所有|即可|不會|無法|絕對|任何|永遠|全部|只有|只需|只能|才能|不必|不需")
SOFT = re.compile(r"可以|可能|通常|一般|較|越|愈|盡量|儘量|宜|應")


def nums(s):
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", s.replace(",", ""))]


def digits(s):
    d = re.sub(r"\D", "", s).strip("0")
    return d


def bg(s):
    s = re.sub(r"\s", "", s)
    return {s[i:i + 2] for i in range(len(s) - 1)}


def qfeats(q):
    o = q["opts"]
    L = np.array([len(x) for x in o], float)
    lr = L.argsort().argsort()
    num_q = all(nums(x) for x in o) and all(len(re.sub(r"[\d.\s,+\-±°'\"′″a-zA-Z²³/%：:()（）]", "", x)) <= 3 for x in o)
    v = [nums(x)[0] if nums(x) else 0 for x in o]
    vr = np.array(v).argsort().argsort()
    D = [digits(x) for x in o]
    fam = [sum(D[i] == D[j] and D[i] != "" for j in range(4) if j != i) for i in range(4)]
    # derivation: how many other options are a simple transform of this one
    def rel(a, b):
        if a == 0 or b == 0:
            return False
        r = b / a
        return any(abs(r - k) < 1e-6 * max(1, k) for k in (2, 0.5, 10, 0.1, 100, 0.01, 4, 0.25, 3, 1 / 3))
    der = [sum(rel(v[i], v[j]) for j in range(4) if j != i) for i in range(4)]
    B = [bg(x) for x in o]
    sim = [np.mean([len(B[i] & B[j]) / (len(B[i] | B[j]) or 1) for j in range(4) if j != i]) for i in range(4)]
    simr = np.array(sim).argsort().argsort()
    st = bg(q["stem"])
    ov = [len(B[i] & st) / (len(B[i]) or 1) for i in range(4)]
    ovr = np.array(ov).argsort().argsort()
    neg = bool(NEG.search(q["stem"]))
    dec = [max([len(t.split(".")[1]) if "." in t else 0 for t in re.findall(r"\d+(?:\.\d+)?", x)] or [0]) for x in o]
    rows = []
    for i in range(4):
        f = {
            "len_rank": lr[i] / 3, "is_longest": float(lr[i] == 3), "is_shortest": float(lr[i] == 0),
            "len_z": (L[i] - L.mean()) / (L.std() + 1e-9),
            "num_q": float(num_q),
            "num_rank1": float(num_q and vr[i] == 0), "num_rank2": float(num_q and vr[i] == 1),
            "num_rank3": float(num_q and vr[i] == 2), "num_rank4": float(num_q and vr[i] == 3),
            "digit_family": fam[i] / 3, "derives_others": der[i] / 3,
            "sim_rank": simr[i] / 3, "sim_top": float(simr[i] == 3), "sim_bottom": float(simr[i] == 0),
            "stem_overlap_rank": ovr[i] / 3, "stem_overlap": ov[i],
            "abs_word": float(bool(ABS.search(o[i]))), "soft_word": float(bool(SOFT.search(o[i]))),
            "neg_x_longest": float(neg and lr[i] == 3), "neg_x_abs": float(neg and bool(ABS.search(o[i]))),
            "neg_x_sim_top": float(neg and simr[i] == 3),
            "has_neg_word": float(bool(re.search(r"不|非|無", o[i]))),
            "neg_x_has_neg": float(neg and bool(re.search(r"不|非|無", o[i]))),
            "max_decimals": dec[i], "round_number": float(num_q and v[i] == round(v[i])),
            "pos_orig": i / 3,  # original position (exam shuffles, reported only)
        }
        rows.append(f)
    return rows


def run(group_name, qs, use_ngrams, drop_pos=True, folds=5):
    rows, y, gid, texts = [], [], [], []
    for k, q in enumerate(qs):
        for i, f in enumerate(qfeats(q)):
            if drop_pos:
                f.pop("pos_orig")
            rows.append(f)
            y.append(int(str(i + 1) in q["ans"]))
            gid.append(k)
            texts.append(q["opts"][i])
    names = list(rows[0])
    X = csr_matrix(np.array([[r[n] for n in names] for r in rows]))
    y = np.array(y)
    gid = np.array(gid)
    perm = rng.permutation(len(qs))
    fold_of = np.empty(len(qs), int)
    fold_of[perm] = np.arange(len(qs)) % folds
    correct = 0
    total = 0
    exact_multi = 0
    for f in range(folds):
        tr = fold_of[gid] != f
        te = ~tr
        Xtr, Xte = X[tr], X[te]
        if use_ngrams:
            cv = CountVectorizer(analyzer="char", ngram_range=(1, 3), min_df=2, binary=True)
            Ntr = cv.fit_transform([t for t, m in zip(texts, tr) if m])
            Nte = cv.transform([t for t, m in zip(texts, te) if m])
            Xtr, Xte = hstack([Xtr, Ntr]).tocsr(), hstack([Xte, Nte]).tocsr()
        m = LogisticRegression(penalty="l1", solver="liblinear", C=0.5, max_iter=2000)
        m.fit(Xtr, y[tr])
        p = m.predict_proba(Xte)[:, 1]
        g = gid[te]
        yt = y[te]
        for k in np.unique(g):
            idx = np.where(g == k)[0]
            if qs[k]["multi"]:
                n = len(qs[k]["ans"])
                # use the bank prior: pick top-3 (or top-2 if 3rd is weak)
                top = idx[np.argsort(-p[idx])]
                pick = set(top[:3]) if p[top[2]] > 0.5 else set(top[:2])
                exact_multi += set(idx[yt[idx] == 1]) == pick
            else:
                correct += yt[idx[np.argmax(p[idx])]]
            total += 1
    if qs[0]["multi"]:
        print(f"  [{group_name}] 未見過的複選題全對率 = {exact_multi}/{total} = {100*exact_multi/total:.1f}%  (亂猜 3 個≈{100*95/180/4:.1f}%)")
    else:
        print(f"  [{group_name}] 未見過的題目命中率 = {correct}/{total} = {100*correct/total:.1f}%  (亂猜 25%)")
    # final model on all data to show the strongest weights
    m = LogisticRegression(penalty="l1", solver="liblinear", C=0.5, max_iter=2000).fit(X, y)
    w = sorted(zip(names, m.coef_[0]), key=lambda t: -abs(t[1]))
    return [(n, round(float(c), 2)) for n, c in w if abs(c) > 0.05][:8]


groups = {
    "專業單選": [q for q in Q if q["bank"] == "04202" and not q["multi"]],
    "專業單選-數字題": [q for q in Q if q["bank"] == "04202" and not q["multi"] and qfeats(q)[0]["num_q"]],
    "專業單選-文字題": [q for q in Q if q["bank"] == "04202" and not q["multi"] and not qfeats(q)[0]["num_q"]],
    "共同單選": [q for q in Q if q["bank"] != "04202"],
    "複選": [q for q in Q if q["multi"]],
}
for name, qs in groups.items():
    print(f"\n== {name} ({len(qs)} 題) ==")
    w = run(name + " 結構特徵", qs, False)
    print("    最大權重:", w)
    run(name + " 結構+字詞", qs, True)
    # repeat with different splits to show the noise level
    accs = []
