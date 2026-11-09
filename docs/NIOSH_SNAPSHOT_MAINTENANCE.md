# نگهداری نسخهٔ منتخب NIOSH

نسخهٔ فعال: `artin-niosh-selected-2026-11-07-v2`، شامل ۱۲ ماده. چهار رکورد تازه اتانول (0262)، اسید استیک (0002)، اسید نیتریک (0447) و سدیم هیدروکسید (0565) هستند. این مسیر برای رکوردهای منفرد با CAS یکتا طراحی شده است؛ ورود گروه‌های مواد، CASهای چندگانه و کل NPG نیازمند توسعهٔ مدل داده است.

## تهیه و بازبینی نسخهٔ بعد

۱. از فایل فعال `backend/data/occupational_reference.json` یک نسخهٔ نامزد جدا بسازید. نسخهٔ قبلی را برای مقایسه نگه دارید. برای هر تغییر، صفحهٔ رسمی همان NPG ID و CAS را بررسی کنید. متن REL، PEL و IDLH، دوره‌ها، واحدها، skin، Ca، LEL و ارجاع به پیوست‌ها را جدا حفظ کنید. PEL در این بانک به نقل از NPG است و تأیید مقررهٔ جاری نیست.

۲. `version` تازه و `checkedOn` واقعی ثبت کنید. تاریخ بازبینی خود صفحه فقط در صورت مشاهده در `sourceReviewedOn` بیاید؛ در غیر این صورت null بماند. `fetchedAt` و `sourceVersion` برای این مسیر دستی null هستند. فایل نامزد را کنار فایل فعال و با نام متفاوت نگه دارید.

۳. از ریشهٔ مخزن اجرا کنید:

```powershell
backend/venv/Scripts/python.exe backend/eval/review_occupational_snapshot.py --baseline backend/data/occupational_reference.json --candidate output/occupational-candidate.json --report output/occupational-candidate-review.json
```

ابزار فقط گزارش تولید می‌کند و فایل فعال را جایگزین نمی‌کند. گزارش، هش هر دو فایل، رکوردهای افزوده و حذف‌شده، مقدار قبل و بعدِ تمام فیلدهای تغییرکرده و تغییر فراداده را نگه می‌دارد. تاریخ نامعتبر یا عقب‌رفته، CAS با checksum اشتباه یا تکراری، تغییر CAS یک NPG ID، جابه‌جایی agencyها، نشانی نامعتبر و ادعای دریافت زنده رد می‌شوند. حذف رکورد به‌روشنی گزارش می‌شود؛ خودکار تأیید نمی‌شود. تغییر CAS واقعی در منبع باید جداگانه حل شود و از این ابزار عبور داده نشود.

۴. پس از تطبیق تغییرات با منابع رسمی، فایل فعال را جایگزین و نسخه، شمار رکورد و SHA256 سند `docs/OCCUPATIONAL_REFERENCE_SOURCE.json` را هم به‌روز کنید. آزمون‌های زیر را اجرا کنید. گزارش نمونهٔ گذار واقعی v1 به v2 در `output/occupational-reference-v2-review.json` است: چهار افزودن، بدون حذف و بدون تغییر هشت رکورد پیشین.

```powershell
cd backend
venv/Scripts/python.exe -m pytest tests/test_occupational_reference.py tests/test_occupational_update.py -q -p no:cacheprovider
cd ../frontend
node node_modules/vitest/vitest.mjs run src/app/occupational-reference.test.tsx
node node_modules/typescript/bin/tsc --noEmit
```

۵. همهٔ workerهای backend را بازراه‌اندازی کنید؛ catalog در حافظه cache می‌شود و صرف جایگزینی JSON برای پاک‌کردن آن کافی نیست. جست‌وجوی خالی باید پوشش تازه را نشان دهد. یک رکورد افزوده را انتخاب، JSON آن را دانلود و نسخه، تعداد و مقدارهایش را بررسی کنید.

## حدود این مسیر

اعتبارسنجی ساختار و گزارش اختلاف، صحت علمی دادهٔ واردشده را اثبات نمی‌کند؛ تطبیق انسانی با منبع رسمی لازم است. ابزار شبکه، زمان‌بندی دریافت، اعلان تغییر خودکار و انتشار خودکار ندارد. محدودبودن پوشش و نبود دریافت زنده در رابط ذکر می‌شود. نبود ماده در این فایل به معنی نبود حد مواجهه نیست. گروه‌های مواد یا واحدهای ناشناخته نباید به صفر یا یک CAS فرضی تبدیل شوند.

منابع بازبینی چهار رکورد در ۷ نوامبر ۲۰۲۶:

- [Ethyl alcohol](https://www.cdc.gov/niosh/npg/npgd0262.html)
- [Acetic acid](https://www.cdc.gov/niosh/npg/npgd0002.html)
- [Nitric acid](https://www.cdc.gov/niosh/npg/npgd0447.html)
- [Sodium hydroxide](https://www.cdc.gov/niosh/npg/npgd0565.html)
