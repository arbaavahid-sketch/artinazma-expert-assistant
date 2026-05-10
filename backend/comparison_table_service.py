import re
from typing import List, Tuple

KNOWN_METHODS = [
    "XRF",
    "ICP-OES",
    "ICP-MS",
    "ICP",
    "AAS",
    "GC-MS",
    "GC",
    "HPLC",
    "XRD",
    "FTIR",
    "UV-Vis",
]


def _normalize(text: str) -> str:
    text = text or ""
    text = text.replace("ي", "ی").replace("ك", "ک")
    return text.lower()


def has_markdown_table(text: str) -> bool:
    """Detect a real Markdown table separator row."""
    if not text:
        return False

    return bool(
        re.search(
            r"(?m)^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}:?\s*\|\s*:?-{3,}:?",
            text,
        )
    )


def detect_comparison_options(message: str) -> List[str]:
    text = message or ""
    upper_text = text.upper()

    found: List[str] = []

    # Longer method names must be checked before shorter ones.
    for method in KNOWN_METHODS:
        pattern = r"(?<![A-Z0-9])" + re.escape(method.upper()) + r"(?![A-Z0-9])"
        if re.search(pattern, upper_text) and method not in found:
            found.append(method)

    # If ICP is mentioned together with ICP-OES/ICP-MS, keep the specific techniques first.
    if "ICP-OES" in found or "ICP-MS" in found:
        found = [item for item in found if item != "ICP"]

    return found[:3]


def _xrf_icp_table(options: List[str]) -> str:
    icp_columns = [option for option in options if option.startswith("ICP")]

    if "XRF" not in options:
        return ""

    if "ICP-OES" in icp_columns or "ICP-MS" in icp_columns:
        headers = ["معیار", "XRF"] + icp_columns
        rows = [
            [
                "آماده‌سازی نمونه",
                "کم؛ معمولاً بدون هضم",
                "نیازمند آماده‌سازی یا هضم" if "ICP-OES" in icp_columns else None,
                (
                    "نیازمند آماده‌سازی بسیار کنترل‌شده"
                    if "ICP-MS" in icp_columns
                    else None
                ),
            ],
            [
                "حد تشخیص نسبی",
                "مناسب‌تر برای غلظت‌های بالاتر",
                "پایین‌تر از XRF" if "ICP-OES" in icp_columns else None,
                (
                    "بسیار پایین‌تر؛ مناسب trace/ultra-trace"
                    if "ICP-MS" in icp_columns
                    else None
                ),
            ],
            [
                "دقت و صحت",
                "وابسته به ماتریس و کالیبراسیون",
                "بالا برای کار چندعنصری" if "ICP-OES" in icp_columns else None,
                "بسیار بالا در غلظت‌های پایین" if "ICP-MS" in icp_columns else None,
            ],
            [
                "سرعت و سادگی",
                "سریع و ساده",
                "زمان‌برتر از XRF" if "ICP-OES" in icp_columns else None,
                "زمان‌برتر و حساس‌تر به آلودگی" if "ICP-MS" in icp_columns else None,
            ],
            [
                "محدودیت اصلی",
                "اثر ماتریس و یکنواختی نمونه",
                "هضم ناقص و تداخل طیفی" if "ICP-OES" in icp_columns else None,
                (
                    "آلودگی، تداخل جرمی و هزینه بالاتر"
                    if "ICP-MS" in icp_columns
                    else None
                ),
            ],
            [
                "بهترین کاربرد",
                "غربالگری سریع",
                "گزارش دقیق چندعنصری" if "ICP-OES" in icp_columns else None,
                "فلزات در غلظت بسیار پایین" if "ICP-MS" in icp_columns else None,
            ],
        ]

        compact_rows = []
        for row in rows:
            compact_rows.append([cell for cell in row if cell is not None])

        return _build_markdown_table(headers, compact_rows)

    return _build_markdown_table(
        ["معیار", "XRF", "ICP"],
        [
            [
                "آماده‌سازی نمونه",
                "کم؛ معمولاً بدون هضم",
                "نیازمند آماده‌سازی یا هضم اسیدی",
            ],
            [
                "حد تشخیص نسبی",
                "مناسب‌تر برای غلظت‌های بالاتر",
                "پایین‌تر؛ مناسب‌تر برای trace metals",
            ],
            [
                "دقت و صحت",
                "وابسته به ماتریس و کالیبراسیون",
                "معمولاً دقیق‌تر برای گزارش رسمی",
            ],
            ["سرعت و سادگی", "سریع‌تر و ساده‌تر", "زمان‌برتر و وابسته به آماده‌سازی"],
            [
                "محدودیت اصلی",
                "اثر ماتریس، ضخامت و یکنواختی نمونه",
                "هضم ناقص، آلودگی و تداخل طیفی",
            ],
            [
                "بهترین کاربرد",
                "غربالگری سریع و کنترل روتین",
                "اندازه‌گیری دقیق چندعنصری",
            ],
        ],
    )


def _gc_hplc_table() -> str:
    return _build_markdown_table(
        ["معیار", "GC", "HPLC"],
        [
            ["نوع ترکیبات", "فرار و نیمه‌فرار", "غیرفرار، قطبی یا حساس به حرارت"],
            ["فاز متحرک", "گاز حامل", "حلال مایع"],
            [
                "آماده‌سازی نمونه",
                "وابسته به فراریت و تمیزی نمونه",
                "وابسته به حلالیت و فیلتراسیون",
            ],
            [
                "محدودیت اصلی",
                "نامناسب برای ترکیبات غیر فرار",
                "مصرف حلال و حساسیت به ماتریس",
            ],
            [
                "بهترین کاربرد",
                "گازها، حلال‌ها، VOC و BTEX",
                "مواد سنگین‌تر، افزودنی‌ها و ترکیبات قطبی",
            ],
        ],
    )


def _icp_aas_table() -> str:
    return _build_markdown_table(
        ["معیار", "AAS", "ICP"],
        [
            ["تعداد عناصر", "معمولاً تک‌عنصری", "چندعنصری و سریع‌تر"],
            [
                "حد تشخیص نسبی",
                "خوب برای بسیاری از فلزات",
                "معمولاً پایین‌تر؛ به‌ویژه در ICP-MS",
            ],
            ["سرعت", "کندتر برای چند عنصر", "سریع‌تر برای چند عنصر"],
            ["هزینه", "کمتر", "بالاتر"],
            [
                "بهترین کاربرد",
                "تعداد کم عنصر و بودجه محدود",
                "پروفایل کامل فلزات و گزارش دقیق",
            ],
        ],
    )


def _build_markdown_table(headers: List[str], rows: List[List[str]]) -> str:
    header_line = "| " + " | ".join(headers) + " |"
    separator = "|" + "|".join(["---"] * len(headers)) + "|"
    body = []

    for row in rows:
        safe_row = row[: len(headers)]
        while len(safe_row) < len(headers):
            safe_row.append("")
        body.append("| " + " | ".join(safe_row) + " |")

    return "\n".join([header_line, separator] + body)


def build_comparison_table(message: str) -> str:
    options = detect_comparison_options(message)
    normalized = _normalize(message)

    if "XRF" in options and any(option.startswith("ICP") for option in options):
        return _xrf_icp_table(options)

    if "GC" in options and "HPLC" in options:
        return _gc_hplc_table()

    if "ICP" in options and "AAS" in options:
        return _icp_aas_table()

    # Generic two/three-method fallback for recognized techniques.
    if len(options) >= 2:
        headers = ["معیار"] + options
        rows = [
            ["آماده‌سازی نمونه"] + ["بسته به ماتریس نمونه" for _ in options],
            ["حد تشخیص نسبی"] + ["نیازمند بررسی روش و دستگاه" for _ in options],
            ["دقت و صحت"] + ["وابسته به کالیبراسیون و QC" for _ in options],
            ["سرعت و سادگی"] + ["وابسته به آماده‌سازی و اپراتور" for _ in options],
            ["محدودیت اصلی"] + ["وابسته به ماتریس و تداخل‌ها" for _ in options],
            ["بهترین کاربرد"] + ["باید بر اساس هدف آزمون انتخاب شود" for _ in options],
        ]
        return _build_markdown_table(headers, rows)

    # Do not fabricate a table when the options are unclear.
    return ""


def ensure_comparison_table(message: str, answer: str) -> str:
    """Insert a deterministic comparison table if the model omitted it."""
    if not answer or has_markdown_table(answer):
        return answer or ""

    table = build_comparison_table(message)
    if not table:
        return answer

    section = f"\n\n## جدول مقایسه سریع\n\n{table}\n"

    # Place the table after the first summary section when possible.
    marker_patterns = [
        r"(?m)^(##\s*)?تفاوت اصلی\s*:?.*$",
        r"(?m)^(##\s*)?تفاوت بنیادی\s*:?.*$",
        r"(?m)^(##\s*)?مقایسه عملیاتی\s*:?.*$",
    ]

    for pattern in marker_patterns:
        match = re.search(pattern, answer)
        if match:
            return (
                answer[: match.start()].rstrip()
                + section
                + "\n"
                + answer[match.start() :].lstrip()
            )

    return answer.rstrip() + section
