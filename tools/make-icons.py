"""Regenerate the PNG app icons from the same geometry as icons/icon.svg.

Run from the project root:  python tools/make-icons.py
Only needs Pillow. Draws at 4x and downsamples, so edges stay clean.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding='utf-8')

BG = (18, 21, 28, 255)
RING = (36, 42, 54, 255)
ACCENT = (255, 90, 31, 255)
GREEN = (61, 220, 132, 255)

OUT = Path(__file__).resolve().parent.parent / 'icons'
S = 4  # supersample factor


def rr(draw, box, radius, **kw):
    draw.rounded_rectangle([c * S for c in box], radius=radius * S, **kw)


def draw_art(draw, inset=0.0):
    """Draw the barbell + bar-chart mark on a 512 canvas, optionally shrunk toward the centre."""
    def t(v):
        # scale a coordinate toward the centre by (1 - inset)
        return 256 + (v - 256) * (1 - inset)

    def bar(x0, y0, x1, y1, fill, radius=None):
        r = (min(x1 - x0, y1 - y0) / 2 if radius is None else radius) * (1 - inset)
        rr(draw, (t(x0), t(y0), t(x1), t(y1)), r, fill=fill)

    # barbell: outer sleeves, inner plates, connecting bar
    bar(112, 156, 142, 244, ACCENT)
    bar(370, 156, 400, 244, ACCENT)
    bar(162, 130, 212, 270, ACCENT, radius=18)
    bar(300, 130, 350, 270, ACCENT, radius=18)
    bar(196, 183, 316, 217, ACCENT)

    # progress bars sitting on a shared baseline
    for x, top in [(126, 380), (198, 352), (270, 322), (342, 292)]:
        bar(x, top, x + 44, 422, GREEN, radius=12)


def make(size, maskable=False):
    canvas = Image.new('RGBA', (512 * S, 512 * S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    if maskable:
        draw.rectangle([0, 0, 512 * S, 512 * S], fill=BG)
        draw_art(draw, inset=0.16)
    else:
        rr(draw, (0, 0, 512, 512), 112, fill=BG)
        rr(draw, (8, 8, 504, 504), 106, outline=RING, width=6 * S)
        draw_art(draw)
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ('icon-512.png', 512, False),
        ('icon-192.png', 192, False),
        ('apple-touch-icon.png', 180, False),
        ('icon-maskable-512.png', 512, True),
    ]
    for name, size, maskable in jobs:
        img = make(size, maskable)
        if name == 'apple-touch-icon.png':
            flat = Image.new('RGB', img.size, BG[:3])
            flat.paste(img, mask=img.split()[3])
            img = flat
        img.save(OUT / name)
        print(f'wrote {name} ({size}px)')


if __name__ == '__main__':
    main()
