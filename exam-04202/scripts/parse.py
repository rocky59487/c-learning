"""Parse WDA question-bank text (pdftotext -layout) into JSON.

Usage: python3 -I parse.py <raw_dir> <out.json>
"""
import json
import re
import sys
from pathlib import Path

Q_START = re.compile(r"^\s*(\d+)\.\s*\((\d+)\)\s*(.*)$")
SECTION = re.compile(r"(\d{5})\s*(.+?)\s*工作項目\s*(\d+)\s*[：:]\s*(\S+)")
FOOTER = re.compile(r"^\s*(Page \d+ of \d+|\d+\s*/\s*\d+|第\s*\d+\s*頁.*)\s*$")
OPT_SPLIT = re.compile(r"[①②③④]")


def is_wide(ch):
    return ord(ch) > 0x2E7F


def join_line(a, b):
    """Join a wrapped line: no space between two CJK/full-width characters."""
    a = a.rstrip()
    if a and b and is_wide(a[-1]) and is_wide(b[0]) and b[0] not in "①②③④":
        return a + b
    return a + " " + b


def clean(s):
    s = re.sub(r"\s+", " ", s).strip()
    return s


def split_options(body):
    """Return (stem, [opt1..opt4]) from the joined question text."""
    marks = [(m.start(), m.group()) for m in re.finditer(r"[①②③④]", body)]
    # take the first occurrence of each mark in order ①②③④
    pos = []
    want = "①②③④"
    i = 0
    for p, ch in marks:
        if i < 4 and ch == want[i]:
            pos.append(p)
            i += 1
    if len(pos) < 4:
        return clean(body), None
    stem = body[: pos[0]]
    opts = []
    for k in range(4):
        end = pos[k + 1] if k < 3 else len(body)
        opts.append(body[pos[k] + 1 : end])
    tail = ""
    # trailing "。" or stem continuation after option 4 (e.g. "之高差。")
    last = opts[3]
    m = re.search(r"\s{2,}(\S.*)$", last.strip())
    opts = [clean(o).rstrip("。").strip() for o in opts]
    stem = clean(stem)
    # text after option 4 that belongs to the stem, e.g. "④15cm 之高差" -> stem "...約有＿＿之高差"
    m = re.match(r"^(.*?)\s+([之的為表時，,].{1,12})$", opts[3])
    short = max(len(o) for o in opts[:3]) if all(opts[:3]) else 99
    if m and short <= 14 and len(m.group(1)) <= short + 6 and " " not in m.group(1):
        opts[3] = m.group(1).strip()
        stem = stem.rstrip() + "＿＿" + m.group(2).strip()
    return stem, opts


def parse_file(path, bank):
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    qs = []
    cur = None
    section = None
    for ln in lines:
        if FOOTER.match(ln):
            continue
        sm = SECTION.search(ln)
        if sm and "工作項目" in ln and not Q_START.match(ln):
            section = f"{sm.group(3).zfill(2)} {sm.group(4)}"
            continue
        m = Q_START.match(ln)
        if m:
            if cur:
                qs.append(cur)
            cur = {
                "bank": bank,
                "section": section,
                "no": int(m.group(1)),
                "ans": m.group(2),
                "raw": m.group(3),
            }
        elif cur is not None:
            if ln.strip():
                cur["raw"] = join_line(cur["raw"], ln.strip())
    if cur:
        qs.append(cur)
    out = []
    for q in qs:
        stem, opts = split_options(q["raw"])
        q["stem"] = stem
        q["opts"] = opts
        q["multi"] = len(q["ans"]) > 1
        q["deleted"] = "本題刪題" in q["raw"] or "刪題" in stem
        del q["raw"]
        out.append(q)
    return out


def main():
    raw = Path(sys.argv[1])
    allq = []
    files = [("04202", raw / "04202_professional.txt")]
    for n in ["職業安全衛生", "工作倫理與職業道德", "環境保護", "節能減碳"]:
        files.append((n, raw / f"cm_{n}.txt"))
    for bank, f in files:
        qs = parse_file(f, bank)
        # disambiguate single vs multi blocks: question numbers restart within a section
        for q in qs:
            q["id"] = f"{bank}-{q['section'][:2] if q['section'] else '00'}-{'M' if q['multi'] else 'S'}{q['no']:03d}"
        allq += qs
    Path(sys.argv[2]).write_text(json.dumps(allq, ensure_ascii=False, indent=1), encoding="utf-8")
    print("total", len(allq))


if __name__ == "__main__":
    main()
