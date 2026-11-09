"""Read supplied workbooks into a review catalog without evaluating spreadsheet formulas."""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path

import openpyxl


def clean(value):
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda match: chr(int(match[1], 16)), value) if isinstance(value, str) else value


def read_rows(path, sheet):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=False)
    try:
        return [[clean(value) for value in row] for row in workbook[sheet].iter_rows(values_only=True)]
    finally:
        workbook.close()


def build(bank, formulas):
    rows = [row for row in read_rows(bank, "بانک ۹۸ آزمون")[5:] if row and isinstance(row[0], int)]
    items = []
    for row in rows:
        items.append({
            "id": row[0], "name": row[1], "code": row[2], "category": row[3],
            "unit": row[4], "standard_claim": row[5], "model_family": row[6],
            "model_description": row[7], "inputs": row[8], "uncertainty_sources": row[9],
            "source_status": row[10], "method_notes": row[11], "reference": row[12],
            "review_flag": row[15] if len(row) > 15 else None,
            "review_status": "requires_method_review",
            "source_sheet": "بانک ۹۸ آزمون", "source_row": row[0] + 5,
        })
    models = []
    for index, row in enumerate(read_rows(formulas, "فرمول آزمون‌ها")[4:], start=5):
        if row and row[0] and len(row) >= 6:
            models.append(dict(zip(["category", "name", "formula", "unit", "parameters", "notes"], row[:6]),
                               source_row=index, review_status="requires_method_review"))
    return {
        "sources": [{"filename": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                    for path in [bank, formulas]],
        "policy": "Review catalog only. Workbook formulas and links are not executed or treated as verified test methods.",
        "test_count": len(items), "model_families": dict(collections.Counter(item["model_family"] for item in items)),
        "tests": items, "supplementary_models": models,
        "official_basis": {
            "quam": "https://www.eurachem.org/index.php/publications/guides/quam",
            "edition": "3rd edition, 2012",
            "errata": "https://www.eurachem.org/images/stories/Guides/quam/errata/QUAM_ERRATA_v2.pdf",
            "errata_date": "2019-01-21",
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bank", type=Path)
    parser.add_argument("formulas", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    catalog = build(args.bank, args.formulas)
    if catalog["test_count"] != 98:
        raise ValueError("Expected 98 records in the supplied bank")
    args.output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Imported {catalog['test_count']} review records and {len(catalog['supplementary_models'])} supplementary models")
