"""Gera imagens padronizadas (1080x1080) para anuncios OLX/Facebook a partir
das fotos de produto do site, com fundo consistente (tema Ebano & Marfim)
e sombra suave sob o frasco."""

import os
import math
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

SRC_DIR = os.path.join(os.path.dirname(__file__), "products")
OUT_DIR = os.path.join(os.path.dirname(__file__), "products_olx")
CANVAS = 1080
PAD_RATIO = 0.80  # bottle occupies ~80% of canvas height

IVORY = (250, 246, 239)
EDGE = (214, 201, 181)  # warm soft taupe -- stays light so baked-in white
                        # reflections/shadows in the source art blend in

FILES = [
    "bidaya-sex-on-the-rocks.jpg",
    "bidaya-vanilla-porn.jpg",
    "bidaya-ayat.jpg",
    "bidaya-maktub-la-vie.jpg",
    "bidaya-elliur.jpg",
    "milk-drops.png",
    "pink-drops.png",
    "cafe-drops.png",
    "dior-sauvage.png",
    "dior-homme.png",
    "lattafa-khamrah.png",
    "lattafa-yara.png",
    "lattafa-asad.png",
    "lattafa-oud-mood.png",
    "mykonos-california.png",
    "mykonos-myego.png",
    "bidaya-blind-ecstasy.png",
]


def make_background(size):
    """Radial gradient ivory -> ebony, soft and premium."""
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    cx, cy = size / 2, size * 0.45
    max_dist = math.hypot(size * 0.75, size * 0.75)
    for y in range(size):
        for x in range(0, size, 2):
            d = math.hypot(x - cx, y - cy) / max_dist
            d = min(1.0, d)
            r = int(IVORY[0] + (EDGE[0] - IVORY[0]) * d)
            g = int(IVORY[1] + (EDGE[1] - IVORY[1]) * d)
            b = int(IVORY[2] + (EDGE[2] - IVORY[2]) * d)
            px[x, y] = (r, g, b)
            if x + 1 < size:
                px[x + 1, y] = (r, g, b)
    return bg


def extract_bottle_bbox(im_rgba):
    """Some source PNGs bake in a separate reflection/shadow blob (meant for
    a white page) below the bottle. A plain alpha bbox would include it, so
    instead we walk rows top-down and stop at the first real gap after the
    main silhouette -- that isolates just the bottle itself."""
    alpha = im_rgba.split()[-1]
    w, h = im_rgba.size
    row_mass = [sum(alpha.crop((0, y, w, y + 1)).getdata()) for y in range(h)]
    max_mass = max(row_mass) if row_mass else 0
    if not max_mass:
        return (0, 0, w, h)
    thresh = max_mass * 0.02

    top = next((y for y, m in enumerate(row_mass) if m > thresh), 0)
    bottom = top
    gap = 0
    for y in range(top, h):
        if row_mass[y] > thresh:
            bottom = y
            gap = 0
        else:
            gap += 1
            if gap >= 4:
                break

    col_mass = [sum(alpha.crop((x, top, x + 1, bottom + 1)).getdata()) for x in range(w)]
    xs = [x for x, m in enumerate(col_mass) if m > max(col_mass) * 0.02]
    left, right = (min(xs), max(xs)) if xs else (0, w)

    return (left, top, right + 1, bottom + 1)


def strip_gray_reflection(bottle_rgba):
    """Some source PNGs include a flat, neutral-gray contact-shadow next to
    the bottle's own base (meant to sit on a white page); it's fully opaque
    so alpha trimming can't touch it. It's desaturated and sits only in the
    bottom slice of the crop, unlike the bottle body/cap above it, so we key
    it out by color there and leave the rest of the bottle untouched."""
    w, h = bottle_rgba.size
    band_top = int(h * 0.88)
    band = bottle_rgba.crop((0, band_top, w, h))

    r, g, b, a = band.split()
    maxc = ImageChops.lighter(ImageChops.lighter(r, g), b)
    minc = ImageChops.darker(ImageChops.darker(r, g), b)
    desat = ImageChops.subtract(maxc, minc).point(lambda v: 255 if v < 10 else 0)
    midtone = maxc.point(lambda v: 255 if 90 <= v <= 250 else 0)
    is_reflection = ImageChops.darker(desat, midtone)
    is_reflection = is_reflection.filter(ImageFilter.GaussianBlur(3))
    a = Image.composite(Image.new("L", a.size, 0), a, is_reflection)
    band = Image.merge("RGBA", (r, g, b, a))

    out = bottle_rgba.copy()
    out.paste(band, (0, band_top))
    return out


def finish_flat_bg_photo(im_rgb):
    """For the Bidaya JPGs: they already ship with a clean, soft studio
    gradient baked in (no alpha to cut around cleanly). Trying to key out
    that gradient leaves jagged artifacts, so instead we just upscale to
    the shared canvas size and apply a light sharpen/vignette so it sits
    comfortably next to the composited shots without looking disconnected."""
    im = im_rgb.convert("RGB").resize((CANVAS, CANVAS), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=3))

    vignette = Image.new("L", (CANVAS, CANVAS), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse([-CANVAS * 0.15, -CANVAS * 0.15, CANVAS * 1.15, CANVAS * 1.15], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(CANVAS * 0.12))
    dark = Image.new("RGB", (CANVAS, CANVAS), EDGE)
    im = Image.composite(im, dark, vignette)
    return im


def add_shadow(canvas, bottle_rgba, paste_pos):
    """Soft elliptical shadow under the bottle."""
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

    if im.mode == "RGBA" and im.split()[-1].getextrema() != (255, 255):
        # Strip faint low-alpha halos/reflections baked in for a white bg
        # (they clash with our own backdrop+shadow) while keeping the
        # anti-aliased edge of the actual bottle silhouette.
        r, g, b, a = im.split()
        a = a.point(lambda v: 0 if v < 120 else v)
        im = Image.merge("RGBA", (r, g, b, a))

        bbox = extract_bottle_bbox(im)
        bottle = im.crop(bbox)
        bottle = strip_gray_reflection(bottle)

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
    else:
        finish_flat_bg_photo(im).save(out_path, "JPEG", quality=92)

    print("ok:", out_name)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in FILES:
        process(f)


if __name__ == "__main__":
    main()
