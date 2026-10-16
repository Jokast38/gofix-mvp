"""Demo images generated locally with Pillow (no external image service): brand-gradient covers and stylised avatars."""
import random
from io import BytesIO

from PIL import Image, ImageDraw, ImageFilter, ImageOps

PALETTE = [(0, 209, 255), (255, 61, 190), (255, 154, 0), (138, 43, 255), (24, 168, 224), (244, 124, 32)]
NIGHT = (7, 9, 17)


def _mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _webp(img: Image.Image, quality=78) -> bytes:
    out = BytesIO()
    img.save(out, "WEBP", quality=quality, method=4)
    return out.getvalue()


def cover(seed: int, size=(1200, 400)) -> Image.Image:
    rnd = random.Random(seed)
    w, h = size
    c1, c2 = rnd.sample(PALETTE, 2)
    base = Image.new("RGB", size, NIGHT)
    grad = Image.new("RGB", (w, 1))
    for x in range(w):
        grad.putpixel((x, 0), _mix(_mix(NIGHT, c1, 0.55), _mix(NIGHT, c2, 0.55), x / w))
    base = Image.blend(base, grad.resize(size), 0.85)
    glow = Image.new("RGB", size, (0, 0, 0))
    d = ImageDraw.Draw(glow)
    for _ in range(6):
        r = rnd.randint(80, 260)
        cx, cy = rnd.randint(0, w), rnd.randint(-60, h + 60)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rnd.choice(PALETTE))
    base = Image.blend(base, glow.filter(ImageFilter.GaussianBlur(90)), 0.45)
    d = ImageDraw.Draw(base, "RGBA")
    for i in range(14):  # thin "tech" lines, like the landing page halos
        y = rnd.randint(0, h)
        d.line((0, y, w, y + rnd.randint(-120, 120)), fill=(255, 255, 255, 18 + i % 3 * 6), width=1)
    for _ in range(40):
        x, y = rnd.randint(0, w), rnd.randint(0, h)
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 255, 255, rnd.randint(40, 120)))
    return base


def avatar(seed: int, size=512) -> Image.Image:
    rnd = random.Random(seed * 7919)
    c1, c2 = rnd.sample(PALETTE, 2)
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        d.line((0, y, size, y), fill=_mix(_mix(NIGHT, c1, 0.7), _mix(NIGHT, c2, 0.5), y / size))
    skin = rnd.choice([(241, 200, 160), (224, 172, 125), (198, 134, 90), (160, 105, 70), (232, 190, 150)])
    shirt = _mix(rnd.choice(PALETTE), (255, 255, 255), 0.15)
    hair = rnd.choice([(30, 22, 18), (60, 40, 25), (20, 20, 25), (90, 60, 35)])
    cx = size // 2
    d.ellipse((cx - 190, int(size * 0.68), cx + 190, int(size * 1.35)), fill=shirt)  # shoulders
    d.rectangle((cx - 42, int(size * 0.55), cx + 42, int(size * 0.74)), fill=_mix(skin, (0, 0, 0), 0.08))  # neck
    head = (cx - 105, int(size * 0.2), cx + 105, int(size * 0.62))
    if rnd.random() < 0.4:  # long hair / scarf silhouette
        d.ellipse((head[0] - 25, head[1] - 20, head[2] + 25, head[3] + 70), fill=hair)
    d.ellipse(head, fill=skin)
    d.chord((head[0] - 4, head[1] - 12, head[2] + 4, head[3] - 70), 180, 360, fill=hair)
    ey = int(size * 0.42)
    for dx in (-40, 40):
        d.ellipse((cx + dx - 9, ey - 9, cx + dx + 9, ey + 9), fill=(40, 30, 30))
    d.arc((cx - 40, ey + 20, cx + 40, ey + 70), 20, 160, fill=(120, 60, 60), width=6)
    return img.filter(ImageFilter.SMOOTH)


def save_set(storage, img_fn, seed: int, kind: str) -> dict:
    """Store full + thumbnail WebP, mirroring app.services.images (same keys)."""
    full = img_fn(seed)
    sizes = {"photo": [("", (512, 512)), ("thumb", (128, 128))], "cover": [("", (1200, 400)), ("thumb", (480, 160))]}[kind]
    return {f"{kind}_{s}_key" if s else f"{kind}_key": storage.save(_webp(ImageOps.fit(full, sz, Image.LANCZOS)), "webp", folder=f"seed/{kind}s")
            for s, sz in sizes}

