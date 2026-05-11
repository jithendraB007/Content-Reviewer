import os
import json
import base64
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, timezone

SHEET_ID = "1WwSMplrkGH6AsXQp1E6GTfxq7nZLR9ZGOQv2ZQptrGU"
CREDS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "google_credentials.json")
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

REVIEW_HEADERS = [
    "Timestamp", "Job ID", "Q. NO", "Question Type",
    "Question", "Correct Answer", "Difficulty",
    "Overall Status",
    "R1 Grammar", "R2 Spelling", "R3 Ambiguity", "R4 Alignment",
    "R5 Instructions", "R6 Academic Lang", "R7 Options/Exp",
    "R8 Readability", "R9 Formatting", "R10 Punctuation", "R11 EN Consistency",
    "Remarks",
]

FEEDBACK_HEADERS = [
    "Timestamp", "Job ID", "Q. NO", "Rubric",
    "AI Score", "AI Correction",
    "User Verdict", "User Correction", "User Comment",
    "Original Text",
]

_client = None


def _build_credentials():
    b64 = os.environ.get("GOOGLE_CREDENTIALS_B64")
    if b64:
        info = json.loads(base64.b64decode(b64).decode("utf-8"))
        return Credentials.from_service_account_info(info, scopes=SCOPES)
    if os.path.exists(CREDS_PATH):
        return Credentials.from_service_account_file(CREDS_PATH, scopes=SCOPES)
    raise FileNotFoundError("No Google credentials found. Set GOOGLE_CREDENTIALS_B64 or place google_credentials.json in backend/")


def _get_client():
    global _client
    if _client is None:
        _client = gspread.authorize(_build_credentials())
    return _client


def _get_worksheet(tab_name: str, headers: list):
    wb = _get_client().open_by_key(SHEET_ID)
    try:
        ws = wb.worksheet(tab_name)
    except gspread.WorksheetNotFound:
        ws = wb.add_worksheet(title=tab_name, rows=10000, cols=len(headers))
        ws.append_row(headers, value_input_option="RAW")
    return ws


def log_job_results(job_id: str, results: list):
    """Append one row per reviewed question to the Reviews tab."""
    try:
        ws = _get_worksheet("Reviews", REVIEW_HEADERS)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        rows = []
        for r in results:
            rows.append([
                ts,
                job_id[:8],
                r.get("Q. NO", ""),
                r.get("Question Type", ""),
                (r.get("Question", "") or "")[:200],
                r.get("Correct Answer", ""),
                r.get("Difficulty", ""),
                r.get("Overall_Status", ""),
                r.get("R1_Grammatical_Accuracy", ""),
                r.get("R2_Spelling", ""),
                r.get("R3_Ambiguity", ""),
                r.get("R4_Functionality_Alignment", ""),
                r.get("R5_Instruction_Clarity", ""),
                r.get("R6_Academic_Language", ""),
                r.get("R7_Option_Explanation_Consistency", ""),
                r.get("R8_Readability", ""),
                r.get("R9_Formatting_Spacing", ""),
                r.get("R10_Punctuation", ""),
                r.get("R11_EN_Consistency", ""),
                (r.get("Remarks", "") or "")[:500],
            ])
        if rows:
            ws.append_rows(rows, value_input_option="RAW")
            print(f"[SHEETS] Logged {len(rows)} review rows for job {job_id[:8]}")
    except Exception as e:
        print(f"[SHEETS ERROR] log_job_results: {type(e).__name__}: {e}")


def log_feedback(data: dict):
    """Append one feedback row to the Feedback tab."""
    try:
        ws = _get_worksheet("Feedback", FEEDBACK_HEADERS)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        ws.append_row([
            ts,
            data.get("job_id", "")[:8],
            data.get("question_no", ""),
            data.get("rubric_name", ""),
            data.get("ai_score", ""),
            data.get("ai_correction", "") or "",
            data.get("user_verdict", ""),
            data.get("user_correction", "") or "",
            data.get("user_comment", "") or "",
            (data.get("original_text", "") or "")[:300],
        ], value_input_option="RAW")
        print(f"[SHEETS] Logged feedback: {data.get('user_verdict')} on {data.get('rubric_name')} for {data.get('question_no')}")
    except Exception as e:
        print(f"[SHEETS ERROR] log_feedback: {type(e).__name__}: {e}")


def get_training_feedback_from_sheets() -> list:
    """Read all reject/override rows from the Feedback tab for DSPy training."""
    try:
        ws = _get_worksheet("Feedback", FEEDBACK_HEADERS)
        rows = ws.get_all_records()
        result = []
        for row in rows:
            verdict = row.get("User Verdict", "").strip().lower()
            if verdict not in ("reject", "override"):
                continue
            result.append({
                "job_id":          row.get("Job ID", ""),
                "question_no":     row.get("Q. NO", ""),
                "rubric_name":     row.get("Rubric", ""),
                "ai_score":        row.get("AI Score", ""),
                "ai_correction":   row.get("AI Correction", ""),
                "user_verdict":    verdict,
                "user_correction": row.get("User Correction", ""),
                "user_comment":    row.get("User Comment", ""),
                "original_text":   row.get("Original Text", ""),
            })
        print(f"[SHEETS] Loaded {len(result)} training feedback records from Sheets")
        return result
    except Exception as e:
        print(f"[SHEETS ERROR] get_training_feedback_from_sheets: {type(e).__name__}: {e}")
        return []


WEIGHTS_HEADERS = ["Timestamp", "weights_b64"]


def save_optimized_weights(json_path: str):
    """Upload the optimized module JSON to the Weights tab in Google Sheets."""
    try:
        with open(json_path, "r") as f:
            content = f.read()
        b64 = base64.b64encode(content.encode()).decode()
        ws = _get_worksheet("Weights", WEIGHTS_HEADERS)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        ws.append_row([ts, b64], value_input_option="RAW")
        print(f"[SHEETS] Saved optimized weights to Sheets ({len(b64)} chars)")
    except Exception as e:
        print(f"[SHEETS ERROR] save_optimized_weights: {type(e).__name__}: {e}")


def load_optimized_weights(json_path: str) -> bool:
    """Download the latest optimized weights from Sheets and write to json_path. Returns True on success."""
    try:
        ws = _get_worksheet("Weights", WEIGHTS_HEADERS)
        rows = ws.get_all_values()
        data_rows = [r for r in rows[1:] if len(r) >= 2 and r[1].strip()]
        if not data_rows:
            print("[SHEETS] No optimized weights found in Sheets")
            return False
        latest_b64 = data_rows[-1][1].strip()
        content = base64.b64decode(latest_b64).decode()
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        with open(json_path, "w") as f:
            f.write(content)
        print(f"[SHEETS] Loaded optimized weights from Sheets → {json_path}")
        return True
    except Exception as e:
        print(f"[SHEETS ERROR] load_optimized_weights: {type(e).__name__}: {e}")
        return False
