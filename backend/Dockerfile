# ایمیج پایه از آینه‌ی ایرانی آروان (چون Docker Hub در ایران فیلتر است و
# build لیارا با موقعیت ایران انجام می‌شود). در صورت استقرار خارج از ایران،
# می‌توان دوباره به python:3.12-slim برگرداند.
FROM docker-mirror.liara.ir/python:3.12-slim

WORKDIR /app

# نکته: مرحله‌ی apt حذف شد چون build روی موقعیت ایران به مخزن دبیان دسترسی ندارد
# و به آن هم نیازی نیست: psycopg2-binary و بقیه‌ی پکیج‌ها به‌صورت wheel نصب می‌شوند
# (بدون کامپایل) و curl هم روی لیارا لازم نیست.

# Install Python dependencies first (better layer caching)
# از آینه‌ی pip ایرانی استفاده می‌کنیم چون build روی موقعیت ایران به PyPI خارجی
# دسترسی ندارد. اگر این آینه در دسترس نبود، می‌توان آن را با آینه‌ی دیگری عوض کرد.
COPY requirements.txt .
RUN pip install --no-cache-dir \
    -i https://package-mirror.liara.ir/repository/pypi/simple \
    --trusted-host package-mirror.liara.ir \
    -r requirements.txt

# Copy application code
COPY . .

# Create required directories and non-root user
RUN mkdir -p storage uploads knowledge_files \
    && addgroup --system appuser \
    && adduser --system --ingroup appuser appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# --proxy-headers + --forwarded-allow-ips: trust X-Forwarded-For/X-Real-IP from nginx
# so request.client.host is the real client IP (required for per-IP rate limiting and
# brute-force lockout). Safe here because only nginx reaches the backend on the internal network.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
