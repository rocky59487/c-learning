"""Assemble the study page. Usage: python3 -I assemble.py template cards.json imgdir out.html"""
import base64, json, sys
from pathlib import Path
tpl, cards, imgdir, out = sys.argv[1:5]
cards_s = Path(cards).read_text(encoding='utf-8')
imgs = {p.name: 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted(Path(imgdir).glob('*.png'))}
html = Path(tpl).read_text(encoding='utf-8').replace('__CARDS__', cards_s.replace('</', '<\\/')).replace('__IMGS__', json.dumps(imgs))
Path(out).write_text(html, encoding='utf-8')
print(out, len(html.encode()) // 1024, 'KB')
