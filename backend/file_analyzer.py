import pandas as pd
from pypdf import PdfReader
from pathlib import Path


def analyze_excel_or_csv(file_path: str) -> dict:
    path = Path(file_path)

    if path.suffix.lower() == ".csv":
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)

    numeric_df = df.select_dtypes(include="number")

    result = {
        "columns": list(df.columns),
        "rows_count": len(df),
        "numeric_summary": {},
        "preview": df.head(10).fillna("").to_dict(orient="records"),
    }

    if not numeric_df.empty:
        result["numeric_summary"] = numeric_df.describe().fillna("").to_dict()

    return result


def read_pdf_text(file_path: str) -> str:
    reader = PdfReader(file_path)
    text = ""

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

    return text[:12000]