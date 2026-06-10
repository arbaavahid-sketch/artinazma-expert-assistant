"""
استخراج عکس محصولات از سایت و ساخت نقشه‌ی slug → عکس برای کاتالوگ فرانت‌اند.

از همان تابع موجود `extract_page_metadata` (site_resource_service) استفاده می‌کند
که og:image صفحه‌ی محصول را می‌خواند. خروجی در:
    frontend/src/lib/product-images.json
نوشته می‌شود و صفحه‌ی /products به‌صورت خودکار عکس‌ها را نمایش می‌دهد.

اجرا (در پوشه‌ی backend، با venv فعال و دسترسی اینترنت):
    python enrich_product_images.py
"""

import json
import os
import time
import urllib.parse

from site_resource_service import extract_page_metadata

BASE = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(BASE, "artinazma_site_index.json")
OUT_PATH = os.path.join(
    BASE, "..", "frontend", "src", "lib", "product-images.json"
)


def product_slugs() -> list[tuple[str, str]]:
    """فهرست (slug, url) محصولات سایت فارسی را برمی‌گرداند."""
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


def main() -> None:
    items = product_slugs()
    print(f"تعداد محصولات: {len(items)}")

    images: dict[str, str] = {}
    for i, (slug, url) in enumerate(items, 1):
        try:
            meta = extract_page_metadata(url)
            img = (meta or {}).get("image_url", "")
            if img:
                images[slug] = img
                print(f"[{i}/{len(items)}] ✅ {slug}")
            else:
                print(f"[{i}/{len(items)}] —  بدون عکس: {slug}")
        except Exception as exc:  # noqa: BLE001
            print(f"[{i}/{len(items)}] ❌ {slug}: {exc}")
        time.sleep(0.6)  # مودبانه؛ به سرور فشار نیاوریم

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(images, fh, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"\nنوشته شد: {OUT_PATH}")
    print(f"عکس پیدا شد برای {len(images)} از {len(items)} محصول.")


if __name__ == "__main__":
    main()
