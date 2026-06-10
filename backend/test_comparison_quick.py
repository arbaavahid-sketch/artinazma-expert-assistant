"""
تست سریع اصلاح «جدول مقایسه» — بدون نیاز به OpenAI یا اجرای سرور.
اجرا:  python test_comparison_quick.py
"""

import comparison_table_service as c

msg = "تفاوت ASTM D2622 و D4294 برای اندازه‌گیری گوگرد در فرآورده نفتی چیست؟"

options = c.detect_comparison_options(msg)
out = c.ensure_comparison_table(msg, "هر دو روش برای گوگرد هستند.")
has_table = c.has_markdown_table(out)
must = ["جدول مقایسه", "WDXRF", "EDXRF", "ماتریس نمونه", "انتخاب روش"]

print("=" * 50)
print("گزینه‌های تشخیص‌داده‌شده:", options)
print("جدول درج شد؟", has_table)
for m in must:
    print(f"  شامل {m!r}؟", m in out)
print("=" * 50)

ok = options == ["WDXRF", "EDXRF"] and has_table and all(m in out for m in must)
print("✅ اصلاح درست کار می‌کند!" if ok else "❌ مشکلی هست — خروجی بالا را برای من بفرست.")
