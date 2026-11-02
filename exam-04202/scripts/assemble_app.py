"""Assemble the app. Usage: python3 -I assemble_app.py app/template.html data/app_items.json img data/triggers.json OUT [--pwa]"""
import base64, json, sys
from pathlib import Path
tpl, items, imgdir, trig, out = sys.argv[1:6]
pwa = "--pwa" in sys.argv
imgs = {p.name: "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode() for p in sorted(Path(imgdir).glob("*.png"))}
T = json.load(open(trig, encoding="utf-8"))["rules"]
T = [{"d": int(r["rule"] == "不選"), "t": r["token"], "s": r["cum_score"], "c": list(dict.fromkeys(c["opt"] for c in r["ctx"]))[:2]} for r in T]
J = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
head = ('<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#1d5fa8">'
        '<link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="icon-192.png">') if pwa else ""
js = "if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}" if pwa else ""
html = (Path(tpl).read_text(encoding="utf-8").replace("__ITEMS__", Path(items).read_text(encoding="utf-8").replace("</", "<\\/"))
        .replace("__IMGS__", J(imgs)).replace("__TRIG__", J(T)).replace("__PWA_HEAD__", head).replace("__PWA_JS__", js))
if pwa:  # standalone page needs its own skeleton
    html = ('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
            + html.replace("<style>", "</head><body><style>", 1) + "</body></html>")
Path(out).write_text(html, encoding="utf-8")
print(out, len(html.encode()) // 1024, "KB")
