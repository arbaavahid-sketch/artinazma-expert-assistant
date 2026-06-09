"""Answer-quality evaluation for the ArtinAzma chat assistant.

Where `run_chat_eval.py` only checks *intent routing*, this script measures the
thing that actually matters for a domain expert assistant: **is the answer
correct, grounded, well-cited, and free of hallucination?**

Pipeline per case:
  1. POST the case message to a running backend ``/chat`` endpoint and collect
     the real answer + returned sources + pipeline metadata.
  2. Run deterministic checks (web-search behaviour, sources present).
  3. Run an LLM-as-judge that scores the answer against the dataset's
     ``must_include`` concepts, ``must_not_include`` constraints and
     ``quality_checks`` rubric, plus groundedness / citation / hallucination.
  4. Aggregate into per-dimension averages and a pass/fail per case, and write
     JSON + Markdown reports next to the intent eval reports.

The judge reuses the project's OpenAI configuration
(``OPENAI_API_KEY`` / optional ``OPENAI_BASE_URL`` / ``OPENAI_MODEL``). Set
``OPENAI_JUDGE_MODEL`` to use a different model for grading than for answering.

Usage:
  # Backend must be running on :8000 and OPENAI_API_KEY must be set.
  python scripts/run_quality_eval.py
  python scripts/run_quality_eval.py --api-url http://127.0.0.1:8000 --limit 3
  python scripts/run_quality_eval.py --no-judge          # deterministic only
  python scripts/run_quality_eval.py --save-raw raw.json # cache backend answers
  python scripts/run_quality_eval.py --replay raw.json   # re-judge cached answers
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = ROOT / "docs" / "evals" / "chat_eval_set.json"
DEFAULT_OUTPUT = ROOT / "docs" / "evals" / "latest_quality_report.json"
DEFAULT_MARKDOWN_OUTPUT = ROOT / "docs" / "evals" / "latest_quality_report.md"
BACKEND_DIR = ROOT / "backend"

# A case passes the quality bar when the judge's overall score clears this
# threshold AND there are no hard failures (constraint violation / hallucination).
PASS_THRESHOLD = 70


# ── Load .env so OPENAI_API_KEY etc. are available when run standalone ────────
def _load_env() -> None:
    for env_path in (BACKEND_DIR / ".env", ROOT / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def load_cases(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    cases = data.get("cases", [])
    if not isinstance(cases, list) or not cases:
        raise ValueError(f"No eval cases found in {path}")
    return cases


# ── Backend call ──────────────────────────────────────────────────────────────
def post_chat(api_url: str, case: dict[str, Any], timeout: int) -> dict[str, Any]:
    url = api_url.rstrip("/") + "/chat"
    payload = {
        "message": case["message"],
        "domain": case.get("domain", "auto"),
        "user_id": "quality_eval_runner",
        "response_mode": "auto",
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


# ── LLM judge ─────────────────────────────────────────────────────────────────
def _build_openai_client():
    """Reuse the backend's configured OpenAI client when possible.

    The backend (``ai_service``) builds a client that routes through the
    project's proxy and applies a DoH DNS patch — required to reach OpenAI in
    this deployment. Importing it gives the judge the same connectivity. Fall
    back to a vanilla client (honouring proxy env vars) if the import fails.
    """
    sys.path.insert(0, str(BACKEND_DIR))
    try:
        from ai_service import client as backend_client  # applies proxy + DoH
        return backend_client
    except Exception as exc:
        print(f"  (note: backend ai_service client unavailable: {exc}; using direct client)")

    try:
        from openai import OpenAI
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("openai package not installed; run inside backend venv") from exc

    import httpx
    kwargs: dict[str, Any] = {"api_key": os.getenv("OPENAI_API_KEY")}
    base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_API_BASE")
    if base_url:
        kwargs["base_url"] = base_url
    # Honour an explicit OpenAI proxy the same way the backend does.
    proxy = os.getenv("OPENAI_PROXY") or os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
    if proxy:
        try:
            kwargs["http_client"] = httpx.Client(proxy=proxy)
        except Exception:
            pass
    return OpenAI(**kwargs)


JUDGE_SYSTEM = (
    "You are a strict QA reviewer for a Persian/English technical assistant that "
    "serves the oil, gas, petrochemical and laboratory-equipment industry. You "
    "grade a single assistant answer against a rubric. Be rigorous: reward "
    "answers that are specific, practically useful and grounded in the provided "
    "sources or in well-established domain knowledge; penalise vague filler, "
    "wrong standard/method substitutions, and fabricated precise numbers "
    "(e.g. exact LOD/detection limits) stated without a source. Respond with "
    "ONLY a JSON object, no prose, no code fences."
)


def _judge_prompt(case: dict[str, Any], answer: str, sources: list[dict[str, Any]]) -> str:
    src_lines = []
    for s in sources:
        src_lines.append(
            f"[{s.get('citation_id', '?')}] {s.get('title') or s.get('file_name') or 'untitled'} "
            f"(score={s.get('score')}): {s.get('excerpt', '')}"
        )
    sources_block = "\n".join(src_lines) if src_lines else "(no internal sources returned)"

    rubric = case.get("quality_checks", [])
    must_include = case.get("must_include", [])
    must_not = case.get("must_not_include", [])

    return f"""Grade the assistant answer below.

USER QUESTION ({case.get('language')}, domain={case.get('domain')}):
{case['message']}

RETRIEVED SOURCES (what the answer was allowed to ground itself on):
{sources_block}

ASSISTANT ANSWER:
{answer}

RUBRIC — concepts that SHOULD appear (judge by meaning, not exact string):
{json.dumps(must_include, ensure_ascii=False)}

CONSTRAINTS — the answer MUST NOT do any of these (each is a sentence):
{json.dumps(must_not, ensure_ascii=False)}

QUALITY CHECKS — judge each as pass/fail:
{json.dumps(rubric, ensure_ascii=False)}

Return JSON with EXACTLY these keys:
{{
  "groundedness": <int 0-5>,        // claims supported by sources or solid domain knowledge; fabricated specifics score low
  "citation_quality": <int 0-5>,    // are factual/standard claims attributed to a source when one exists? 5 if no citation needed
  "relevance": <int 0-5>,           // directly answers the question, no padding
  "covered_concepts": [<subset of the SHOULD-appear concepts that are genuinely addressed>],
  "missing_concepts": [<the SHOULD-appear concepts that are absent>],
  "constraint_violations": [<the CONSTRAINT sentences the answer violated, verbatim; [] if none>],
  "rubric_results": {{"<each quality check sentence>": "pass" | "fail"}},
  "hallucination": <true|false>,    // true if it invents standards, numbers, products or facts
  "hallucination_note": "<short reason or empty>",
  "overall": <int 0-100>,           // holistic quality
  "rationale": "<one or two sentences>"
}}"""


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def judge_answer(client, model: str, case: dict[str, Any], answer: str,
                 sources: list[dict[str, Any]]) -> dict[str, Any]:
    """Call the judge model via the Responses API and parse its JSON verdict."""
    resp = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": _judge_prompt(case, answer, sources)},
        ],
    )
    raw = getattr(resp, "output_text", None) or ""
    return _extract_json(raw)


# ── Scoring ───────────────────────────────────────────────────────────────────
def score_case(case: dict[str, Any], chat_data: dict[str, Any],
               verdict: dict[str, Any] | None) -> dict[str, Any]:
    sources = chat_data.get("sources", []) or []
    web_expected = case.get("should_use_web")
    web_actual = chat_data.get("web_search_used")

    deterministic = {
        "web_expected": web_expected,
        "web_actual": web_actual,
        "web_ok": (web_expected is None) or (web_actual == web_expected),
        "source_count": chat_data.get("source_count", len(sources)),
        "search_mode": chat_data.get("search_mode"),
        "answer_mode": chat_data.get("answer_mode"),
        "answer_length": len((chat_data.get("answer") or "").strip()),
        "empty_answer": not (chat_data.get("answer") or "").strip(),
    }

    result: dict[str, Any] = {
        "id": case["id"],
        "language": case.get("language"),
        "domain": case.get("domain"),
        "deterministic": deterministic,
    }

    if verdict is None:
        # Deterministic-only mode: pass = answered + web behaviour correct.
        result["judged"] = False
        result["passed"] = deterministic["web_ok"] and not deterministic["empty_answer"]
        return result

    overall = int(verdict.get("overall", 0) or 0)
    violations = verdict.get("constraint_violations", []) or []
    hallucination = bool(verdict.get("hallucination", False))
    rubric_results = verdict.get("rubric_results", {}) or {}
    rubric_failed = [k for k, v in rubric_results.items() if str(v).lower() != "pass"]

    passed = (
        overall >= PASS_THRESHOLD
        and not violations
        and not hallucination
        and deterministic["web_ok"]
        and not deterministic["empty_answer"]
    )

    result.update({
        "judged": True,
        "passed": passed,
        "overall": overall,
        "scores": {
            "groundedness": verdict.get("groundedness"),
            "citation_quality": verdict.get("citation_quality"),
            "relevance": verdict.get("relevance"),
        },
        "covered_concepts": verdict.get("covered_concepts", []),
        "missing_concepts": verdict.get("missing_concepts", []),
        "constraint_violations": violations,
        "rubric_failed": rubric_failed,
        "hallucination": hallucination,
        "hallucination_note": verdict.get("hallucination_note", ""),
        "rationale": verdict.get("rationale", ""),
    })
    return result


def _avg(values: list[float]) -> float | None:
    nums = [v for v in values if isinstance(v, (int, float))]
    return round(sum(nums) / len(nums), 2) if nums else None


# ── Runner ────────────────────────────────────────────────────────────────────
def run(args: argparse.Namespace) -> dict[str, Any]:
    cases = load_cases(Path(args.dataset))
    if args.limit:
        cases = cases[: args.limit]

    # Source of answers: live backend, or a cached --replay file.
    replay: dict[str, Any] = {}
    if args.replay:
        replay = {r["id"]: r for r in json.loads(Path(args.replay).read_text(encoding="utf-8"))}

    client = None
    judge_model = os.getenv("OPENAI_JUDGE_MODEL") or os.getenv("OPENAI_MODEL", "gpt-5.1")
    if not args.no_judge:
        if not os.getenv("OPENAI_API_KEY"):
            print("WARNING: OPENAI_API_KEY not set -> falling back to --no-judge mode.")
            args.no_judge = True
        else:
            client = _build_openai_client()

    results: list[dict[str, Any]] = []
    raw_answers: list[dict[str, Any]] = []
    started = time.time()

    for case in cases:
        cid = case["id"]
        error = None
        if replay:
            chat_data = replay.get(cid, {}).get("chat_data", {})
            if not chat_data:
                error = "no replay entry"
        else:
            try:
                chat_data = post_chat(args.api_url, case, args.timeout)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                chat_data = {}
                error = f"{type(exc).__name__}: {exc}"

        raw_answers.append({"id": cid, "chat_data": chat_data})

        verdict = None
        if error is None and not args.no_judge and client is not None:
            try:
                verdict = judge_answer(
                    client, judge_model, case,
                    chat_data.get("answer", "") or "",
                    chat_data.get("sources", []) or [],
                )
            except Exception as exc:  # judge failure shouldn't crash the run
                error = f"judge_error: {type(exc).__name__}: {exc}"

        if error and chat_data == {}:
            results.append({"id": cid, "language": case.get("language"),
                            "domain": case.get("domain"), "judged": False,
                            "passed": False, "error": error})
            continue

        scored = score_case(case, chat_data, verdict)
        if error:
            scored["error"] = error
            scored["passed"] = False
        results.append(scored)
        print(f"  {'PASS' if scored['passed'] else 'FAIL'} {cid} "
              f"overall={scored.get('overall', '-')}")

    if args.save_raw:
        Path(args.save_raw).write_text(
            json.dumps(raw_answers, ensure_ascii=False, indent=2), encoding="utf-8")

    passed = sum(1 for r in results if r.get("passed"))
    judged = [r for r in results if r.get("judged")]
    return {
        "dataset": str(Path(args.dataset)),
        "api_url": None if args.replay else args.api_url,
        "judge_model": None if args.no_judge else judge_model,
        "judged": not args.no_judge,
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "averages": {
            "overall": _avg([r.get("overall") for r in judged]),
            "groundedness": _avg([r.get("scores", {}).get("groundedness") for r in judged]),
            "citation_quality": _avg([r.get("scores", {}).get("citation_quality") for r in judged]),
            "relevance": _avg([r.get("scores", {}).get("relevance") for r in judged]),
            "hallucination_rate": round(
                sum(1 for r in judged if r.get("hallucination")) / len(judged), 2
            ) if judged else None,
        },
        "duration_seconds": round(time.time() - started, 2),
        "results": results,
    }


def markdown_report(report: dict[str, Any]) -> str:
    a = report["averages"]
    lines = [
        "# Chat Answer-Quality Report",
        "",
        f"- Judge model: `{report['judge_model']}`",
        f"- Dataset: `{report['dataset']}`",
        f"- Total: `{report['total']}` | Passed: `{report['passed']}` | Failed: `{report['failed']}`",
        f"- Avg overall: `{a['overall']}` / 100",
        f"- Avg groundedness: `{a['groundedness']}` / 5 | "
        f"citation: `{a['citation_quality']}` / 5 | relevance: `{a['relevance']}` / 5",
        f"- Hallucination rate: `{a['hallucination_rate']}`",
        f"- Duration: `{report['duration_seconds']}s`",
        "",
        "| Status | Case | Overall | Ground | Cite | Rel | Issues |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in report["results"]:
        status = "PASS" if r.get("passed") else "FAIL"
        sc = r.get("scores", {})
        issues = []
        if r.get("error"):
            issues.append(r["error"])
        if r.get("constraint_violations"):
            issues.append("violations: " + "; ".join(r["constraint_violations"]))
        if r.get("hallucination"):
            issues.append("hallucination: " + (r.get("hallucination_note") or "yes"))
        if r.get("missing_concepts"):
            issues.append("missing: " + ", ".join(r["missing_concepts"]))
        if r.get("rubric_failed"):
            issues.append("rubric fail: " + ", ".join(r["rubric_failed"]))
        if not r.get("deterministic", {}).get("web_ok", True):
            d = r["deterministic"]
            issues.append(f"web expected {d['web_expected']} got {d['web_actual']}")
        lines.append(
            f"| {status} | `{r['id']}` | {r.get('overall', '-')} | "
            f"{sc.get('groundedness', '-')} | {sc.get('citation_quality', '-')} | "
            f"{sc.get('relevance', '-')} | {'; '.join(issues) or '-'} |"
        )

    weak = [r for r in report["results"] if not r.get("passed")]
    if weak:
        lines.extend(["", "## Weak / failing cases", ""])
        for r in weak:
            lines.append(f"### `{r['id']}`")
            if r.get("rationale"):
                lines.append(f"- {r['rationale']}")
            for key in ("constraint_violations", "missing_concepts", "rubric_failed"):
                if r.get(key):
                    lines.append(f"- {key}: {', '.join(r[key])}")
            if r.get("error"):
                lines.append(f"- error: {r['error']}")
            lines.append("")
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run ArtinAzma answer-quality evals")
    p.add_argument("--dataset", default=str(DEFAULT_DATASET))
    p.add_argument("--api-url", default="http://127.0.0.1:8000")
    p.add_argument("--timeout", type=int, default=120)
    p.add_argument("--limit", type=int, default=0, help="Only run first N cases")
    p.add_argument("--no-judge", action="store_true", help="Deterministic checks only")
    p.add_argument("--save-raw", default="", help="Cache backend answers to this JSON")
    p.add_argument("--replay", default="", help="Re-judge answers from a saved raw JSON")
    p.add_argument("--output", default=str(DEFAULT_OUTPUT))
    p.add_argument("--markdown-output", default=str(DEFAULT_MARKDOWN_OUTPUT))
    return p.parse_args()


def main() -> int:
    _load_env()
    args = parse_args()
    print("Running answer-quality eval...")
    report = run(args)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    Path(args.markdown_output).write_text(markdown_report(report), encoding="utf-8")
    a = report["averages"]
    print(f"\nTotal={report['total']} passed={report['passed']} failed={report['failed']} "
          f"avg_overall={a['overall']} hallucination_rate={a['hallucination_rate']}")
    print(f"Report:   {args.output}")
    print(f"Markdown: {args.markdown_output}")
    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
