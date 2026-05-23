"""Email service for sending weekly reports to admin."""

import smtplib
import json
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

logger = logging.getLogger("artin_email")


def get_email_settings(get_setting_fn) -> dict:
    """Load email settings from app_settings table."""
    raw = get_setting_fn("email_settings", "{}")
    try:
        return json.loads(raw)
    except Exception:
        return {}


def save_email_settings(set_setting_fn, settings: dict) -> None:
    set_setting_fn("email_settings", json.dumps(settings))


def build_weekly_report_html(stats: dict) -> str:
    """Build an HTML email body for the weekly report."""
    now = datetime.utcnow()
    week_start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    week_end = now.strftime("%Y-%m-%d")

    questions = stats.get("total_questions", 0)
    new_requests = stats.get("new_requests", 0)
    total_requests = stats.get("total_requests", 0)
    knowledge_files = stats.get("total_files", 0)
    knowledge_chunks = stats.get("total_chunks", 0)
    domains = stats.get("top_domains", [])

    domains_rows = ""
    for d in domains[:5]:
        domains_rows += f"<tr><td style='padding:6px 12px;border-bottom:1px solid #f0f0f0'>{d.get('domain','—')}</td><td style='padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:#4f46e5'>{d.get('count',0)}</td></tr>"

    if not domains_rows:
        domains_rows = "<tr><td colspan='2' style='padding:10px;color:#888;text-align:center'>داده‌ای موجود نیست</td></tr>"

    html = f"""
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:Tahoma,Arial,sans-serif;direction:rtl">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07)">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 36px">
    <div style="color:#fff;font-size:22px;font-weight:bold">گزارش هفتگی آرتین آزما</div>
    <div style="color:#c7d2fe;font-size:13px;margin-top:6px">{week_start} تا {week_end}</div>
  </div>

  <!-- Stats grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:24px 28px">
    <div style="background:#f0fdf4;border-radius:14px;padding:18px 20px;border:1px solid #bbf7d0">
      <div style="font-size:28px;font-weight:900;color:#15803d">{questions}</div>
      <div style="font-size:13px;color:#166534;margin-top:4px">سوال دریافتی این هفته</div>
    </div>
    <div style="background:#fffbeb;border-radius:14px;padding:18px 20px;border:1px solid #fde68a">
      <div style="font-size:28px;font-weight:900;color:#d97706">{new_requests}</div>
      <div style="font-size:13px;color:#92400e;margin-top:4px">درخواست جدید مشتریان</div>
    </div>
    <div style="background:#eff6ff;border-radius:14px;padding:18px 20px;border:1px solid #bfdbfe">
      <div style="font-size:28px;font-weight:900;color:#1d4ed8">{knowledge_files}</div>
      <div style="font-size:13px;color:#1e3a8a;margin-top:4px">فایل در بانک دانش</div>
    </div>
    <div style="background:#f5f3ff;border-radius:14px;padding:18px 20px;border:1px solid #ddd6fe">
      <div style="font-size:28px;font-weight:900;color:#7c3aed">{knowledge_chunks}</div>
      <div style="font-size:13px;color:#4c1d95;margin-top:4px">بخش متنی (chunk)</div>
    </div>
  </div>

  <!-- Domain breakdown -->
  <div style="padding:0 28px 24px">
    <div style="font-size:14px;font-weight:bold;color:#374151;margin-bottom:12px">حوزه‌های پرتکرار سوالات</div>
    <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:12px;overflow:hidden">
      <thead>
        <tr style="background:#e5e7eb">
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280">حوزه</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280">تعداد</th>
        </tr>
      </thead>
      <tbody>{domains_rows}</tbody>
    </table>
  </div>

  <!-- Total requests -->
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px;font-size:13px;color:#6b7280">
    جمع کل درخواست‌های مشتریان تاکنون: <strong style="color:#374151">{total_requests}</strong>
  </div>

  <!-- Footer -->
  <div style="background:#4f46e5;padding:16px 28px;text-align:center">
    <div style="color:#c7d2fe;font-size:12px">این ایمیل به صورت خودکار توسط سیستم آرتین آزما ارسال شده است.</div>
  </div>
</div>
</body>
</html>
"""
    return html


def send_weekly_report(settings: dict, stats: dict) -> tuple[bool, str]:
    """
    Send the weekly report email.
    Returns (success, message).
    """
    smtp_host = settings.get("smtp_host", "").strip()
    smtp_port = int(settings.get("smtp_port", 587))
    smtp_user = settings.get("smtp_user", "").strip()
    smtp_pass = settings.get("smtp_pass", "").strip()
    from_addr = settings.get("from_addr", smtp_user).strip() or smtp_user
    to_addr = settings.get("to_addr", "").strip()

    if not smtp_host:
        return False, "آدرس SMTP سرور تنظیم نشده است."
    if not to_addr:
        return False, "آدرس ایمیل گیرنده تنظیم نشده است."

    html_body = build_weekly_report_html(stats)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"گزارش هفتگی آرتین آزما — {datetime.utcnow().strftime('%Y-%m-%d')}"
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
            server.ehlo()
            server.starttls()

        if smtp_user and smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.sendmail(from_addr, [to_addr], msg.as_string())
        server.quit()
        logger.info(f"Weekly report sent to {to_addr}")
        return True, f"گزارش با موفقیت به {to_addr} ارسال شد."
    except smtplib.SMTPAuthenticationError:
        return False, "خطای احراز هویت SMTP — نام کاربری یا رمز عبور اشتباه است."
    except smtplib.SMTPConnectError:
        return False, f"خطا در اتصال به {smtp_host}:{smtp_port}"
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False, f"خطا در ارسال ایمیل: {str(e)}"
