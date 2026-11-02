"""Shrink figure crops for the web: grayscale, 1000px wide, 16-level palette. Usage: python3 -I shrink_img.py DIR"""
import sys
from pathlib import Path
from PIL import Image
for p in Path(sys.argv[1]).glob("*.png"):
    im = Image.open(p).convert("L")
    if im.width > 1000:  # first pass only: drop the "41. (1)" label that shows the official answer
        im = im.crop((int(im.width * 0.09), 0, im.width, im.height))
    if im.width > 1000:
        im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
    im = im.point(lambda v: 255 if v > 215 else v).quantize(16)
    im.save(p, optimize=True)
