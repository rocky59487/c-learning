"""Crop image-based questions from the PDF. Usage: python3 -I crop.py bank.pdf questions.json outdir"""
import json, re, subprocess, sys, html
from pathlib import Path
from PIL import Image
pdf, qjson, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
Q = [q for q in json.load(open(qjson, encoding='utf-8')) if q['bank'] == '04202']
xml = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
pages = re.split(r'<page ', xml)[1:]
starts = []  # (page_idx, y, no, ans)
for pi, pg in enumerate(pages):
    H = float(re.search(r'height="([\d.]+)"', pg).group(1))
    words = re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">(.*?)</word>', pg)
    for i, (x, y, w) in enumerate(words):
        if float(x) < 80 and re.fullmatch(r'\d+\.', w) and i + 1 < len(words) and re.fullmatch(r'\(\d+\)', words[i+1][2]):
            starts.append((pi, float(y), int(w[:-1]), words[i+1][2][1:-1], H))
print('starts', len(starts), 'questions', len(Q))
assert len(starts) == len(Q), 'mismatch'
extra = set(json.load(open(sys.argv[4]))) if len(sys.argv) > 4 else set()
def sus(q):
    t = q['stem'] + '|' + '|'.join(q['opts'])
    return (any(len(o) == 0 for o in q['opts']) or re.search(r'下圖|下表|如圖|附圖', q['stem'])
            or any(re.search(r'(為|於|是|約|在|則)$', o) for o in q['opts']) or re.search(r' 的|為 ，|為 。|次，| 倍', t))
need = [i for i, q in enumerate(Q) if q['id'] in extra or sus(q)]
cache = {}
res = {}
for i in need:
    q = Q[i]; pi, y, no, ans, H = starts[i]
    assert no == q['no'] and ans == q['ans'], (q['id'], no, ans)
    y2 = starts[i+1][1] if i + 1 < len(starts) and starts[i+1][0] == pi else H - 40
    if pi not in cache:
        subprocess.run(['pdftoppm', '-r', '110', '-f', str(pi+1), '-l', str(pi+1), '-png', '-singlefile', pdf, f'/tmp/claude-0/pg{pi}'], check=True)
        cache[pi] = Image.open(f'/tmp/claude-0/pg{pi}.png')
    im = cache[pi]; s = im.width / 708
    crop = im.crop((int(40*s), int((y-4)*s), int(680*s), int((y2-2)*s)))
    fn = f"{q['id']}.png"; crop.save(out / fn, optimize=True)
    res[q['id']] = fn
json.dump(res, open(out / 'index.json', 'w'), ensure_ascii=False, indent=1)
print('cropped', len(res))
