# دریافت و پخش ویدئوی آزمایشگاه

تاریخ بررسی: ۸ نوامبر ۲۰۲۶. بخشی از مرحلهٔ ۹؛ فایل‌های تصویری دوباره تولید یا فشرده نشده‌اند.

## رفتار فعلی

`LaboratoryArtwork.tsx` مشترک میان محاسبات سریع و محیط کار، در HTML اولیه فقط پوستر را نمایش می‌دهد. تا زمانی که قاب در دید، تب visible، کاهش حرکت غیرفعال و save-data غیرفعال نباشند، تگ video و source مربوط به MP4 اضافه نمی‌شود. اگر مرورگر matchMedia نداشته باشد، پوستر باقی می‌ماند؛ اگر IntersectionObserver نداشته باشد، دید قاب شرط محدودکننده نیست ولی ترجیح حرکت/داده و وضعیت تب همچنان بررسی می‌شوند.

در شرایط مجاز، پس از ورود قاب به دید، ویدئو با play() خودکار شروع می‌شود. autoplay attribute بی‌قید استفاده نشده است. ویدئو muted، loop و playsInline دارد؛ native controls و هر دکمهٔ روی تصویر همچنان حذف‌اند. picture-in-picture و remote playback غیرفعال مانده‌اند.

با خروج قاب از دید یا پنهان‌شدن تب، همان video مکث می‌کند. پس از بازگشت، همان node بدون تغییر currentTime ادامه می‌دهد؛ تایمر JavaScript برای دورزدن پایان حلقه یا شروع از صفر اضافه نشده است. با فعال‌شدن کاهش حرکت یا save-data، video کنار می‌رود و پوستر جای آن می‌آید؛ با برداشتن ترجیح محدودکننده، فعال‌سازی دوباره در شرایط مجاز ممکن است. دادهٔ قبلاً دانلودشده بازگردانده یا صرفه‌جویی‌شده فرض نمی‌شود.

خطای رسانه به پوستر پایدار برمی‌گردد و با notificationهای دید دوباره خودکار درخواست نمی‌شود. رد play() نیز بدون promise rejection رهاشده مدیریت می‌شود؛ مرورگر ممکن است پوستر ویدئو را نگه دارد. در unmount، observer، listenerها و پخش پاک‌سازی می‌شوند. label دو زبان، تجهیزات آزمایشگاهی را توصیف می‌کند و در حالت ثابت ادعای متحرک‌بودن ندارد.

## دارایی‌ها و HTML تولید

- ویدئو: `laboratory-equipment-glow-loop-v2.mp4`، 3,800,443 بایت.
- پوستر: `laboratory-equipment-glow-loop-poster.jpg`، 134,457 بایت.
- loop هموار، نرخ فریم و محتوای فایل قبلی تغییر نکرده‌اند؛ شواهد تولید قبلی در LABORATORY_HERO_ASSET.md است.

در HTML تولید هر دو `/calculators` و `/calculators/workspace`، تعداد تگ video و source MP4 صفر و حضور پوستر تأیید شد. این شمارش، ادعای زمان شبکه یا مقدار واقعی transfer نیست. inventory، SHA256 فایل‌ها و روش در `output/stage9-media-loading-audit.json` ثبت‌اند.

## بررسی‌ها

هفت آزمون `laboratory-artwork.test.tsx` عدم اتصال MP4 پیش از ورود قاب، reduced-motion و save-data، مکث/ادامه با حفظ currentTime، تب پنهان، تغییر ترجیح، خطای رسانه، رد autoplay و cleanup را پوشش می‌دهند. وضعیت سنسورها و روش‌های پخش در این آزمون‌ها شبیه‌سازی شده‌اند؛ پخش واقعی مرورگر با این تست‌ها ادعا نمی‌شود. TypeScript، lint و build با ۴۸ مسیر موفق‌اند.

در مرور زندهٔ build تولید روی اجرای محلی جدا، `prefers-reduced-motion: reduce` واقعاً فعال بود. DOM پوستر، صفر video و صفر source MP4 را نشان داد؛ تصویر `docs/stage9-media-reduced-motion-fa.png` ثبت شد. تنظیم سیستم/مرورگر تغییر نکرد. پخش عادی، خروج از دید و tab-hidden در این مرور زنده قابل مشاهده نبودند؛ آزمون خودکار این مسیرها انجام شده است و پذیرش دستگاهی آن‌ها باز می‌ماند. تب و فرایند آزمایشی در پایان بسته شدند.

## حدود پذیرش

این تغییر بارگذاری زودهنگام MP4 را در شرایط غیرمجاز حذف می‌کند؛ سرعت واقعی، مصرف CPU/باتری یا صرفه‌جویی یکسان برای تمام کاربران اندازه‌گیری نشده است. در حالت مجاز، دریافت ویدئو همچنان انجام می‌شود. بهینه‌سازی فونت/دیگر تصاویر، زمان‌سنجی روی دستگاه/شبکهٔ نماینده و مرور کامل Android جزو کارهای باز مرحلهٔ ۹ هستند. هیچ گزینه یا API key تازه به کاربر اضافه نشده است.
# Workbench playback update — 9 November 2026

The user explicitly requested visible motion after reporting a static poster. The workbench now opts into `requestedMotion` on the shared artwork; this overrides reduced-motion only for this requested decorative clip. Other uses retain the default reduced-motion policy. Save-data, offscreen/hidden pause and error fallback remain in place. The workbench frame is 260×195 CSS pixels on desktop and 220 pixels wide on small screens. Browser inspection confirmed muted looping playback with advancing currentTime and no media error. Eight artwork tests include this explicit-request case. The complete frontend suite passed 615 tests, and production build and scoped lint passed. Mobile layout at 320 and 390 pixels had no document overflow.
