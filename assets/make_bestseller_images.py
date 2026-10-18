"""Gera imagens padronizadas (1080x1080) para os anuncios dos best-sellers
importados do catalogo (comprasparaguai), mesmo tratamento visual das 16
primeiras: fundo ivory/taupe + sombra suave. Essas fotos chegam em fundo
branco solido (nao transparente), entao primeiro recortamos o fundo por
proximidade de cor antes de compor."""

import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC_DIR = os.path.join(os.path.dirname(__file__), "products_bestsellers")
OUT_DIR = os.path.join(os.path.dirname(__file__), "products_olx")
CANVAS = 1080
PAD_RATIO = 0.80

IVORY = (250, 246, 239)
EDGE = (214, 201, 181)

FILES = [
    "dior-sauvage-bs.jpg",
    "chanel-bleu-de-chanel.jpg",
    "armani-acqua-di-gio.avif",
    "chanel-n5.jpg",
    "lancome-la-vie-est-belle.png",
    "ch-good-girl.jpg",
    "ysl-libre.png",
    "ysl-black-opium.jpg",
    "ck-euphoria.jpg",
    "jpg-scandal.jpg",
    "dg-light-blue.jpg",
    "chanel-coco-mademoiselle.jpg",
    "paco-olympea.jpg",
    "armani-my-way.png",
    "ch-212-vip-rose.png",
]


def make_background(size):
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    import math
    cx, cy = size / 2, size * 0.45
    max_dist = math.hypot(size * 0.75, size * 0.75)
    for y in range(size):
        for x in range(0, size, 2):
            d = min(1.0, math.hypot(x - cx, y - cy) / max_dist)
            r = int(IVORY[0] + (EDGE[0] - IVORY[0]) * d)
            g = int(IVORY[1] + (EDGE[1] - IVORY[1]) * d)
            b = int(IVORY[2] + (EDGE[2] - IVORY[2]) * d)
            px[x, y] = (r, g, b)
            if x + 1 < size:
                px[x + 1, y] = (r, g, b)
    return bg


def key_out_white(im_rgb, near=233):
    """Flat white studio background -> alpha, via flood fill from the image
    border inward. A plain color-distance threshold would also kill a white
    label or clear glass cap in the middle of the bottle (seen on Chanel
    N5); flood fill only removes white that is *connected to the edge*, so
    white print still inside the product silhouette survives."""
    from collections import deque

    im_rgb = im_rgb.convert("RGB")
    w, h = im_rgb.size
    px = im_rgb.load()

    candidate = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= near and g >= near and b >= near:
                candidate[y * w + x] = 1

    visited = bytearray(w * h)
    q = deque()

    def seed(x, y):
        idx = y * w + x
        if candidate[idx] and not visited[idx]:
            visited[idx] = 1
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if candidate[idx] and not visited[idx]:
                    visited[idx] = 1
                    q.append((nx, ny))

    alpha = Image.new("L", (w, h), 255)
    apx = alpha.load()
    for y in range(h):
        for x in range(w):
            if visited[y * w + x]:
                apx[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))

    r, g, b = im_rgb.split()
    return Image.merge("RGBA", (r, g, b, alpha))


def extract_bbox(im_rgba):
    """Simple first-to-last-row-with-mass bbox (no gap-breaking): these are
    plain studio product shots, and a clear glass neck/cap often creates a
    legitimate low-alpha gap in the middle of the bottle's own silhouette
    that must stay included, unlike the separate reflection blobs the other
    script had to cut out."""
    alpha = im_rgba.split()[-1]
    w, h = im_rgba.size
    row_mass = [sum(alpha.crop((0, y, w, y + 1)).getdata()) for y in range(h)]
    max_mass = max(row_mass) if row_mass else 0
    if not max_mass:
        return (0, 0, w, h)
    thresh = max_mass * 0.02
    ys = [y for y, m in enumerate(row_mass) if m > thresh]
    top, bottom = (min(ys), max(ys)) if ys else (0, h - 1)

    col_mass = [sum(alpha.crop((x, top, x + 1, bottom + 1)).getdata()) for x in range(w)]
    xs = [x for x, m in enumerate(col_mass) if m > max(col_mass) * 0.02]
    left, right = (min(xs), max(xs)) if xs else (0, w)
    return (left, top, right + 1, bottom + 1)


def add_shadow(canvas, bottle_rgba, paste_pos):
    bw, bh = bottle_rgba.size
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    cx = paste_pos[0] + bw // 2
    bottom_y = paste_pos[1] + bh
    ew, eh = int(bw * 0.72), int(bw * 0.10)
    sd.ellipse(
        [cx - ew // 2, bottom_y - eh // 2, cx + ew // 2, bottom_y + eh // 2],
        fill=(150, 130, 100, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    canvas.alpha_composite(shadow)


def process(fname):
    path = os.path.join(SRC_DIR, fname)
    im = Image.open(path)
    out_name = os.path.splitext(fname)[0] + ".jpg"
    out_path = os.path.join(OUT_DIR, out_name)

    im = key_out_white(im)
    bbox = extract_bbox(im)
    bottle = im.crop(bbox)

    target_h = int(CANVAS * PAD_RATIO)
    scale = target_h / bottle.height
    target_w = int(bottle.width * scale)
    bottle = bottle.resize((target_w, target_h), Image.LANCZOS)

    bg = make_background(CANVAS).convert("RGBA")
    canvas = bg.copy()

    paste_x = (CANVAS - target_w) // 2
    paste_y = CANVAS - target_h - int(CANVAS * 0.08)

    add_shadow(canvas, bottle, (paste_x, paste_y))
    canvas.alpha_composite(bottle, (paste_x, paste_y))
    canvas.convert("RGB").save(out_path, "JPEG", quality=92)
    print("ok:", out_name)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in FILES:
        process(f)


if __name__ == "__main__":
    main()
