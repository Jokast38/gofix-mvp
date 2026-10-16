from io import BytesIO

from PIL import Image, ImageOps

from app.adapters.storage import get_storage

# kind -> [(key suffix, size)]: every upload is re-encoded to WebP (light pages, EXIF stripped).
SPECS = {
    "photo": [("", (512, 512)), ("thumb", (128, 128))],
    "cover": [("", (1200, 400)), ("thumb", (480, 160))],
}


def to_webp(img: Image.Image, size: tuple[int, int], quality: int = 80) -> bytes:
    out = BytesIO()
    ImageOps.fit(img, size, Image.LANCZOS).save(out, "WEBP", quality=quality, method=4)
    return out.getvalue()


def store_image(data: bytes, kind: str, folder: str) -> dict:
    """Returns {"<kind>_key": ..., "<kind>_thumb_key": ...}. Raises ValueError("invalid_image")."""
    try:
        Image.open(BytesIO(data)).verify()
        img = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
    except Exception:
        raise ValueError("invalid_image")
    storage = get_storage()
    return {f"{kind}_{suffix}_key" if suffix else f"{kind}_key": storage.save(to_webp(img, size), "webp", folder=folder)
            for suffix, size in SPECS[kind]}
