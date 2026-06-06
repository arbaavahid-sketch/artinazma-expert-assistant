"""Run lightweight evaluations for the ArtinAzma chat assistant.

Default mode is offline and checks intent detection only. API mode posts the
same cases to a running backend /chat endpoint and checks returned metadata plus
simple answer text expectations.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = ROOT / "docs" / "evals" / "chat_eval_set.json"
DEFAULT_OUTPUT = ROOT / "docs" / "evals" / "latest_eval_report.json"
BACKEND_DIR = ROOT / "backend"


def load_cases(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    cases = data.get("cases", [])
    if not isinstance(cases, list) or not cases:
        raise ValueError(f"No eval cases found in {path}")
    return cases


def detect_intent_offline(message: str, domain: str) -> dict[str, Any]:
    sys.path.insert(0, str(BACKEND_DIR))
    from intent_service import detect_question_intent

    return detect_question_intent(message=message, domain=domain)


def post_chat(api_url: str, case: dict[str, Any], timeout: int) -> dict[str, Any]:
    url = api_url.rstrip("/") + "/chat"
    payload = {
        "message": case["message"],
        "domain": case.get("domain", "auto"),
        "user_id": "eval_runner",
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


def normalize_text(value: str) -> str:
    return (value or "").casefold()


def score_case(
    case: dict[str, Any],
    intent_data: dict[str, Any],
    chat_data: dict[str, Any] | None,
) -> dict[str, Any]:
    expected_intent = case["expected_intent"]
    actual_intent = (
        chat_data.get("question_intent")
        if chat_data
        else intent_data.get("intent")
    )
    intent_ok = actual_intent == expected_intent

    checks: dict[str, Any] = {
        "intent_ok": intent_ok,
        "expected_intent": expected_intent,
        "actual_intent": actual_intent,
    }

    if chat_data is not None:
        answer = normalize_text(chat_data.get("answer", ""))
        must_include = case.get("must_include", [])
        must_not_include = case.get("must_not_include", [])
        checks.update(
            {
                "web_expected": case.get("should_use_web"),
                "web_actual": chat_data.get("web_search_used"),
                "web_ok": chat_data.get("web_search_used") == case.get("should_use_web"),
                "missing_terms": [
                    term for term in must_include if normalize_text(term) not in answer
                ],
                "forbidden_terms_found": [
                    term for term in must_not_include if normalize_text(term) in answer
                ],
                "search_mode": chat_data.get("search_mode"),
                "source_count": chat_data.get("source_count", len(chat_data.get("sources", []))),
                "answer_mode": chat_data.get("answer_mode"),
            }
        )

    passed = checks["intent_ok"]
    if chat_data is not None:
        passed = (
            passed
            and checks["web_ok"]
            and not checks["missing_terms"]
            and not checks["forbidden_terms_found"]
        )

    return {
        "id": case["id"],
        "language": case.get("language"),
        "domain": case.get("domain"),
        "passed": passed,
        "checks": checks,
    }


def run_eval(args: argparse.Namespace) -> dict[str, Any]:
    cases = load_cases(Path(args.dataset))
    results = []
    started = time.time()

    for case in cases:
        intent_data = detect_intent_offline(
            message=case["message"],
            domain=case.get("domain", "auto"),
        )
        chat_data = None
        error = None

        if args.mode == "api":
            try:
                chat_data = post_chat(args.api_url, case, args.timeout)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                error = f"{type(exc).__name__}: {exc}"

        result = score_case(case, intent_data, chat_data)
        if error:
            result["passed"] = False
            result["error"] = error
        results.append(result)

    passed = sum(1 for result in results if result["passed"])
    return {
        "dataset": str(Path(args.dataset)),
        "mode": args.mode,
        "api_url": args.api_url if args.mode == "api" else None,
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "duration_seconds": round(time.time() - started, 2),
        "results": results,
    }


def print_summary(report: dict[str, Any]) -> None:
    print(
        f"Eval mode={report['mode']} total={report['total']} "
        f"passed={report['passed']} failed={report['failed']} "
        f"duration={report['duration_seconds']}s"
    )
    for result in report["results"]:
        marker = "PASS" if result["passed"] else "FAIL"
        checks = result["checks"]
        print(
            f"{marker} {result['id']} "
            f"intent={checks.get('actual_intent')} expected={checks.get('expected_intent')}"
        )
        if result.get("error"):
            print(f"  error: {result['error']}")
        if checks.get("missing_terms"):
            print(f"  missing_terms: {', '.join(checks['missing_terms'])}")
        if checks.get("forbidden_terms_found"):
            print(f"  forbidden_terms_found: {', '.join(checks['forbidden_terms_found'])}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run ArtinAzma chat evals")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET), help="Path to eval JSON")
    parser.add_argument(
        "--mode",
        choices=["intent", "api"],
        default="intent",
        help="intent=offline intent checks, api=POST cases to backend /chat",
    )
    parser.add_argument("--api-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--timeout", type=int, default=90, help="API request timeout seconds")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Report JSON output path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = run_eval(args)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print_summary(report)
    print(f"Report written to {output}")
    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

