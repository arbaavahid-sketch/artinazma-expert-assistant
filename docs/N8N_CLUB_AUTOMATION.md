# n8n — اتوماسیون کانال تلگرام کلوپ

n8n کنار آرتین روی همان سرور اجرا می‌شود ولی **جزو این مخزن نیست** و deploy آرتین به آن دست نمی‌زند.

## چه چیزی کجاست

| بخش | محل |
|---|---|
| n8n | `/opt/n8n/docker-compose.yml` روی سرور، کانتینر `n8n`، داده در volume `n8n_n8n_data` |
| شبکه | n8n به شبکه `artinazma_default` (شبکه docker compose آرتین) وصل است |
| پنل n8n | فقط با تونل SSH: `ssh -L 5678:localhost:5678 root@<server>` و بعد `http://localhost:5678` |
| وب‌هوک تلگرام | `https://assistant.artinazma.net/n8n-hook/webhook/...` — بلوک `n8n-hook` در `nginx/nginx.conf` |

## وابستگی‌ها به این مخزن

1. **`nginx/nginx.conf`** — بلوک `location ~ ^/n8n-hook/...` نباید حذف شود. بدون آن پیش‌نویس‌ها به تلگرام می‌رسند ولی دکمه‌های «انتشار / رد» کار نمی‌کنند.
   این بلوک با `resolver` + متغیر نوشته شده تا اگر n8n خاموش باشد nginx و آرتین بالا بیایند.
2. **`make docker-up`** — بعد از بالا آوردن آرتین، اگر `/opt/n8n` وجود داشته باشد n8n را هم دوباره به شبکه وصل می‌کند.

## بعد از هر deploy آرتین (اگر از `make docker-up` استفاده نشد)

```bash
cd /opt/n8n && docker compose up -d
curl -s http://127.0.0.1:5678/healthz; echo                              # باید {"status":"ok"}
curl -s https://assistant.artinazma.net/n8n-hook/webhook/test; echo       # باید JSON «webhook ... not registered» از n8n
```

## هشدار

- در `/opt/n8n` هرگز `docker compose down -v` نزنید (همه workflowها پاک می‌شوند).
- توکن ربات و کلید OpenAI فقط در Credentials خود n8n ذخیره می‌شوند، نه در این مخزن.
