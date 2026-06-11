"""
دانلود عکس محصولات از سایت به‌صورت محلی و ساخت نقشه‌ی slug → مسیر محلی.

چرا محلی؟ artinazma.net روی عکس‌ها محافظت hotlink دارد و وقتی عکس از دامنه‌ی
دیگری (مثل localhost) درخواست شود بلاک می‌شود و کارت خالی می‌ماند. با دانلود
عکس‌ها در public/ همه‌چیز هم‌منشأ و همیشه قابل‌نمایش می‌شود (و سریع‌تر هم هست).

از همان `extract_page_metadata` (site_resource_service) برای یافتن og:image
استفاده می‌کند، سپس فایل را در:
    frontend/public/product-images/<slug>.<ext>
ذخیره و نقشه‌ی زیر را می‌سازد:
    frontend/src/lib/product-images.json   →  { slug: "/product-images/<slug>.<ext>" }

اجرا (در پوشه‌ی backend، با venv فعال و دسترسی اینترنت):
    python enrich_product_images.py
"""

import json
import os
import re
import time
import urllib.parse

import requests

from site_resource_service import extract_page_metadata

BASE = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(BASE, "artinazma_site_index.json")
PUBLIC_DIR = os.path.join(BASE, "..", "frontend", "public", "product-images")
MAP_PATH = os.path.join(BASE, "..", "frontend", "src", "lib", "product-images.json")

# هدرها برای دور زدن محافظت hotlink هنگام دانلود (Referer همان سایت).
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ArtinAzmaCatalog/1.0)",
    "Referer": "https://artinazma.net/",
}


def product_slugs() -> list[tuple[str, str]]:
    data = json.load(open(INDEX_PATH, encoding="utf-8"))
    seen, out = set(), []
    for item in data.get("items", []):
        url = item.get("url", "")
        if "/product/" not in url or "/en/" in url or "/ru/" in url:
            continue
        slug = urllib.parse.unquote(url.rstrip("/").split("/product/")[-1])
        if slug in seen:
            continue
        seen.add(slug)
        out.append((slug, url))
    return out


def safe_name(slug: str) -> str:
    """نام فایل امن و اسکی برای ذخیره و مسیر URL."""
    name = re.sub(r"[^a-zA-Z0-9._-]", "-", slug).strip("-")
    return name or "product"


def ext_from(url: str) -> str:
    path = urllib.parse.urlparse(url).path.lower()
    for e in (".webp", ".png", ".jpg", ".jpeg", ".gif"):
        if path.endswith(e):
            return ".jpg" if e == ".jpeg" else e
    return ".jpg"


def main() -> None:
    items = product_slugs()
    print(f"تعداد محصولات: {len(items)}")
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    images: dict[str, str] = {}
    for i, (slug, url) in enumerate(items, 1):
        try:
            meta = extract_page_metadata(url)
            img_url = (meta or {}).get("image_url", "")
            if not img_url:
                print(f"[{i}/{len(items)}] —  بدون og:image: {slug}")
                continue

            fname = safe_name(slug) + ext_from(img_url)
            resp = requests.get(img_url, headers=HEADERS, timeout=20)
            if resp.status_code == 200 and resp.content:
                with open(os.path.join(PUBLIC_DIR, fname), "wb") as fh:
                    fh.write(resp.content)
                images[slug] = f"/product-images/{fname}"
                print(f"[{i}/{len(items)}] ✅ {slug}  ({len(resp.content)//1024}KB)")
            else:
                print(f"[{i}/{len(items)}] ❌ HTTP {resp.status_code}: {slug}")
        except Exception as exc:  # noqa: BLE001
            print(f"[{i}/{len(items)}] ❌ {slug}: {exc}")
        time.sleep(0.5)

    with open(MAP_PATH, "w", encoding="utf-8") as fh:
        json.dump(images, fh, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"\nنقشه نوشته شد: {MAP_PATH}")
    print(f"عکس دانلود شد برای {len(images)} از {len(items)} محصول.")
    print("حالا frontend را rebuild/refresh کن تا عکس‌ها بیایند.")


if __name__ == "__main__":
    main()
