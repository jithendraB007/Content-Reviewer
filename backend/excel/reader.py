import pandas as pd
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import REQUIRED_COLUMNS, VALID_QUESTION_TYPES


def read_and_validate(file_path: str) -> tuple:
    """
    Returns (DataFrame, list_of_errors).
    Empty error list means the file is valid.
    All cells are returned as strings; NaN replaced with empty string.
    """
    errors = []

    try:
        df = pd.read_excel(file_path, dtype=str)
    except Exception as e:
        return None, [f"Cannot read file: {e}"]

    df.fillna("", inplace=True)
    df.columns = [str(c).strip() for c in df.columns]

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        errors.append(f"Missing required columns: {missing}")
        return None, errors

    if df.empty:
        errors.append("File contains no data rows")
        return None, errors

    invalid_types = (
        df[~df["Question Type"].isin(VALID_QUESTION_TYPES)]["Question Type"]
        .unique()
        .tolist()
    )
    invalid_types = [t for t in invalid_types if t.strip()]
    if invalid_types:
        errors.append(f"Unknown question types found: {invalid_types}")

    empty_qno = df[df["Q. NO"].str.strip() == ""].index.tolist()
    if empty_qno:
        errors.append(f"Missing Q. NO at rows: {[i + 2 for i in empty_qno]}")

    return df, errors
