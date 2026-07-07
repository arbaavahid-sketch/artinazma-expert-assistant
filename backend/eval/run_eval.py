"""
هارنس ارزیابی سبک برای دستیار آرتین.

کاری که می‌کند
──────────────
۱. سؤال‌های eval_questions.json را می‌خواند.
۲. هر سؤال را دقیقاً مثل یک کاربر واقعی به endpoint زنده‌ی /chat می‌فرستد
   (کل پایپ‌لاین: intent → بازیابی دانش → پاسخ AI → وب‌سرچ).
۳. هر پاسخ را با «داور LLM» (LLM-as-judge) و rubric سخت‌گیرانه نمره می‌دهد.
   داور از همان مسیر شبکه‌ی خود اپ (ai_service._chat_via_requests با DoH/پروکسی)
   استفاده می‌کند تا روی همین شبکه هم کار کند.
۴. گزارش خوانا در ترمینال + یک فایل JSON کامل تولید می‌کند.

این ابزار چیزی به اپ اضافه نمی‌کند؛ یک «خط‌کش» است: قبل و بعد از هر تغییرِ
پرامپت/مدل/دانش یک بار اجرا کن و اعداد را مقایسه کن.

نکته‌ی مهم درباره‌ی دقت
──────────────────────
داور فقط بر اساس معیارهای داخل eval_questions.json قضاوت می‌کند و اجازه ندارد
از دانش بیرونی شرط جدید بسازد. تا وقتی یک کارشناس دامنه معیارها را تأیید نکرده
(verified=true)، نمره‌ی آن سؤال «آزمایشی» است و در گزارش جدا علامت می‌خورد.

اجرا
────
    cd backend
    .\\venv\\Scripts\\Activate.ps1
    uvicorn main:app --port 8000        # در یک ترمینال، بک‌اند باید بالا باشد
    python -m eval.run_eval             # در ترمینال دیگر

پرچم‌ها
    --base-url URL     آدرس بک‌اند (پیش‌فرض http://127.0.0.1:8000)
    --questions PATH   مسیر فایل سؤال‌ها
    --out PATH         مسیر گزارش JSON (پیش‌فرض eval/reports/eval_<timestamp>.json)
    --only ID[,ID]     فقط این شناسه‌ها را اجرا کن
    --limit N          فقط N سؤال اول
    --judge-model M    مدل داور (پیش‌فرض EVAL_JUDGE_MODEL یا مدل اصلی اپ)
    --min-accuracy P   اگر دقت کل کمتر از P (٪) شد، با کد خطای غیرصفر خارج شو (برای CI)
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import sys
import time
from pathlib import Path

import requests

# کنسول ویندوز پیش‌فرض cp1252 است و متن فارسی را خراب/کرش می‌کند؛ خروجی را UTF-8 کن.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

# مسیر بک‌اند را به sys.path اضافه کن تا بشود ai_service را ایمپورت کرد.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# ai_service خودش load_dotenv() می‌کند و مسیر شبکه‌ی مقاوم (DoH/پروکسی) را می‌آورد.
from ai_service import _chat_via_requests, MODEL as APP_MODEL  # noqa: E402

DEFAULT_BASE_URL = os.getenv("EVAL_BASE_URL", "http://127.0.0.1:8000")
JUDGE_MODEL = os.getenv("EVAL_JUDGE_MODEL", "") or APP_MODEL
EVAL_DIR = Path(__file__).resolve().parent


# ─────────────────────────────────────────────────────────────────────────────
#  فراخوانی اپ
# ─────────────────────────────────────────────────────────────────────────────
def ask_app(base_url: str, question: str, timeout: float = 180.0) -> dict:
    """یک سؤال را به /chat می‌فرستد و پاسخ + متادیتای بازیابی را برمی‌گرداند."""
    resp = requests.post(
        f"{base_url.rstrip('/')}/chat",
        json={"message": question, "user_id": "eval_harness"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
#  داور (LLM-as-judge)
# ─────────────────────────────────────────────────────────────────────────────
_JUDGE_SYSTEM = (
    "You are a strict, impartial evaluator of a Persian technical assistant that serves "
    "the oil, gas, petrochemical and lab-equipment industry. Judge ONLY against the "
    "criteria you are given; never invent extra requirements from your own knowledge.\n\n"
    "Definition of hallucination — mark hallucination=true ONLY when the answer contains a "
    "claim that is factually WRONG, or fabricates a specific that cannot be true (an "
    "invented product model, a made-up price, a non-existent standard number), or includes "
    "something listed in must_not_include. A correct, well-established general fact is NOT a "
    "hallucination even if the system retrieved no source for it. Missing sources alone is "
    "never hallucination — it is only reflected in 'grounded'.\n\n"
    "Definition of grounded — grounded=true when the answer's claims are supported by the "
    "retrieved sources OR are correct and consistent with the given criteria. grounded=false "
    "when claims are unsupported AND not backed by the criteria (i.e. the model is guessing). "
    "Reply with JSON only."
)

_JUDGE_TEMPLATE = """معیارهای این سؤال (تنها مرجع قضاوت تو):

سؤال کاربر:
{question}

نکاتی که باید در جواب باشد (must_include):
{must_include}

چیزهایی که نباید در جواب باشد (must_not_include):
{must_not_include}

توضیح معیار (criteria):
{criteria}

منابع بازیابی‌شده توسط سیستم (source_count={source_count}): {sources}

پاسخی که دستیار داده است:
\"\"\"
{answer}
\"\"\"

حالا فقط بر اساس معیارهای بالا قضاوت کن و دقیقاً این JSON را برگردان (بدون متن اضافه):
{{
  "accuracy": 0 | 1 | 2,          // 0=غلط یا بی‌ربط، 1=تا حدی درست/ناقص، 2=کامل و درست
  "covered": ["..."],             // کدام نکات must_include واقعاً پوشش داده شد
  "missed": ["..."],              // کدام نکات must_include جا افتاد
  "hallucination": true | false,  // فقط اگر ادعای «غلط» یا مشخصات جعلی (مدل/قیمت/استاندارد ساختگی) یا موردی از must_not_include آورد. نبودِ منبع به‌تنهایی توهم نیست.
  "grounded": true | false,       // اگر ادعاها با منبع بازیابی‌شده یا با معیارهای داده‌شده سازگارند true؛ اگر حدس بی‌پشتوانه است false
  "reasoning": "یک جمله دلیل کوتاه"
}}"""


def _extract_json(text: str) -> dict:
    """JSON را از خروجی داور بیرون می‌کشد (حتی اگر داخل ```json ... ``` باشد)."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.lstrip().lower().startswith("json"):
            t = t.lstrip()[4:]
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object found in judge output: {text[:200]!r}")
    return json.loads(t[start : end + 1])


def judge_answer(q: dict, app_result: dict, judge_model: str) -> dict:
    """پاسخ اپ را با داور نمره می‌دهد. در صورت خطای داور، یک بار تلاش مجدد می‌کند."""
    answer = app_result.get("answer", "") or ""
    sources = app_result.get("sources", []) or []
    source_titles = ", ".join(
        str(s.get("title") or s.get("source") or s)[:60] for s in sources[:8]
    ) or "(هیچ)"

    prompt = _JUDGE_TEMPLATE.format(
        question=q["question"],
        must_include="\n".join(f"- {x}" for x in q.get("must_include", [])) or "(معیار خاصی تعیین نشده)",
        must_not_include="\n".join(f"- {x}" for x in q.get("must_not_include", [])) or "(هیچ)",
        criteria=q.get("criteria", "") or "(ندارد)",
        source_count=app_result.get("source_count", len(sources)),
        sources=source_titles,
        answer=answer,
    )
    messages = [
        {"role": "system", "content": _JUDGE_SYSTEM},
        {"role": "user", "content": prompt},
    ]

    last_err = None
    for _ in range(2):
        try:
            raw = _chat_via_requests(messages=messages, model=judge_model, temperature=0.0)
            verdict = _extract_json(raw)
            # نرمال‌سازی و اعتبارسنجی حداقلی
            verdict["accuracy"] = int(verdict.get("accuracy", 0))
            if verdict["accuracy"] not in (0, 1, 2):
                verdict["accuracy"] = 0
            verdict["hallucination"] = bool(verdict.get("hallucination", False))
            verdict["grounded"] = bool(verdict.get("grounded", False))
            verdict.setdefault("covered", [])
            verdict.setdefault("missed", [])
            verdict.setdefault("reasoning", "")
            return verdict
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.0)
    return {
        "accuracy": 0,
        "covered": [],
        "missed": [],
        "hallucination": False,
        "grounded": False,
        "reasoning": f"JUDGE_ERROR: {type(last_err).__name__}: {last_err}",
        "judge_error": True,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  اجرا و گزارش
# ─────────────────────────────────────────────────────────────────────────────
def run(args) -> int:
    data = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    questions = data["questions"]

    if args.only:
        wanted = {x.strip() for x in args.only.split(",")}
        questions = [q for q in questions if q["id"] in wanted]
    if args.limit:
        questions = questions[: args.limit]

    if not questions:
        print("هیچ سؤالی برای اجرا پیدا نشد.", file=sys.stderr)
        return 2

    print(f"بک‌اند: {args.base_url}")
    print(f"مدل داور: {args.judge_model}")
    print(f"تعداد سؤال: {len(questions)}\n")

    results = []
    for i, q in enumerate(questions, 1):
        print(f"[{i}/{len(questions)}] {q['id']} … ", end="", flush=True)
        row = {"id": q["id"], "question": q["question"], "verified": q.get("verified", False)}
        t0 = time.monotonic()
        try:
            app_result = ask_app(args.base_url, q["question"])
        except Exception as e:  # noqa: BLE001
            row.update(app_error=f"{type(e).__name__}: {e}", accuracy=0,
                       hallucination=False, grounded=False)
            results.append(row)
            print(f"خطای اتصال به اپ: {e}")
            continue

        row["response_time_ms"] = int((time.monotonic() - t0) * 1000)
        row["intent"] = app_result.get("question_intent")
        row["intent_match"] = (
            None if not q.get("expected_intent")
            else app_result.get("question_intent") == q["expected_intent"]
        )
        row["source_count"] = app_result.get("source_count", 0)
        row["answer"] = app_result.get("answer", "")

        verdict = judge_answer(q, app_result, args.judge_model)
        row.update(
            accuracy=verdict["accuracy"],
            covered=verdict["covered"],
            missed=verdict["missed"],
            hallucination=verdict["hallucination"],
            grounded=verdict["grounded"],
            reasoning=verdict["reasoning"],
        )
        if verdict.get("judge_error"):
            row["judge_error"] = True
        results.append(row)

        flag = "⚠توهم" if verdict["hallucination"] else ("✗" if verdict["accuracy"] == 0 else "✓")
        print(f"acc={verdict['accuracy']}/2 {flag}")

    report = _aggregate(results, args)
    _print_report(report, results)
    _write_report(report, results, args)

    if args.min_accuracy is not None and report["accuracy_pct"] < args.min_accuracy:
        print(f"\nدقت {report['accuracy_pct']}% کمتر از حد آستانه {args.min_accuracy}% است.",
              file=sys.stderr)
        return 1
    return 0


def _aggregate(results: list, args) -> dict:
    scored = [r for r in results if "app_error" not in r]
    n = len(scored)
    max_score = 2 * n if n else 1
    total = sum(r.get("accuracy", 0) for r in scored)
    intent_checked = [r for r in scored if r.get("intent_match") is not None]
    return {
        "timestamp": _dt.datetime.now().isoformat(timespec="seconds"),
        "base_url": args.base_url,
        "judge_model": args.judge_model,
        "total_questions": len(results),
        "scored_questions": n,
        "app_errors": len(results) - n,
        "judge_errors": sum(1 for r in scored if r.get("judge_error")),
        "accuracy_pct": round(total / max_score * 100, 1),
        "hallucinations": sum(1 for r in scored if r.get("hallucination")),
        "ungrounded": sum(1 for r in scored if not r.get("grounded")),
        "intent_match_pct": (
            round(sum(1 for r in intent_checked if r["intent_match"]) / len(intent_checked) * 100, 1)
            if intent_checked else None
        ),
        "no_retrieval": sum(1 for r in scored if r.get("source_count", 0) == 0),
        "verified_questions": sum(1 for r in scored if r.get("verified")),
        "avg_response_time_ms": (
            round(sum(r.get("response_time_ms", 0) for r in scored) / n) if n else 0
        ),
    }


def _print_report(rep: dict, results: list) -> None:
    print("\n" + "═" * 52)
    print("  گزارش ارزیابی دستیار آرتین")
    print("═" * 52)
    print(f"  دقت کل:              {rep['accuracy_pct']}%  "
          f"({rep['scored_questions']} سؤال نمره‌خورده)")
    print(f"  توهم (hallucination): {rep['hallucinations']} مورد")
    print(f"  بدون تکیه بر منبع:    {rep['ungrounded']} مورد")
    if rep["intent_match_pct"] is not None:
        print(f"  تطابق intent:        {rep['intent_match_pct']}%")
    print(f"  بدون بازیابی سند:     {rep['no_retrieval']} مورد")
    print(f"  خطای اتصال به اپ:     {rep['app_errors']} مورد")
    print(f"  خطای داور:           {rep['judge_errors']} مورد")
    print(f"  میانگین زمان پاسخ:    {rep['avg_response_time_ms']} ms")
    print(f"  سؤال‌های تأییدشده:    {rep['verified_questions']} از {rep['scored_questions']}")
    print("─" * 52)
    for r in results:
        if "app_error" in r:
            print(f"  {r['id']:<26} اتصال ناموفق: {r['app_error']}")
            continue
        mark = "⚠" if r.get("hallucination") else ("✗" if r["accuracy"] == 0 else "✓")
        vflag = "" if r.get("verified") else " (آزمایشی)"
        print(f"  {mark} {r['id']:<26} acc={r['accuracy']}/2{vflag}  — {r.get('reasoning','')[:60]}")
    print("═" * 52)
    if rep["verified_questions"] < rep["scored_questions"]:
        print("  ⚠ بعضی معیارها هنوز تأیید نشده‌اند (verified=false).")
        print("    نمره‌ی آن‌ها را قطعی نگیر تا کارشناس دامنه بازبینی کند.")
        print("═" * 52)


def _write_report(rep: dict, results: list, args) -> None:
    out = Path(args.out) if args.out else (
        EVAL_DIR / "reports" / f"eval_{_dt.datetime.now():%Y%m%d_%H%M%S}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"summary": rep, "results": results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nگزارش کامل ذخیره شد: {out}")


def main() -> int:
    p = argparse.ArgumentParser(description="هارنس ارزیابی سبک دستیار آرتین")
    p.add_argument("--base-url", default=DEFAULT_BASE_URL)
    p.add_argument("--questions", default=str(EVAL_DIR / "eval_questions.json"))
    p.add_argument("--out", default=None)
    p.add_argument("--only", default=None, help="فهرست شناسه‌ها با کاما، مثلاً q01_astm_d445,q11_hallucination_fake_model")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--judge-model", default=JUDGE_MODEL)
    p.add_argument("--min-accuracy", type=float, default=None)
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
