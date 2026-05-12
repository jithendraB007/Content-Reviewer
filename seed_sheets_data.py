"""
Seed the Google Sheets 'Reviews' tab with 827 historical questions
across 21 jobs, with random timestamps from 2026-04-10 to 2026-05-11.

Run from the project root:
    d:/content-reviewer/backend/venv/Scripts/python.exe seed_sheets_data.py

Requires google_credentials.json in backend/ (or GOOGLE_CREDENTIALS_B64 env var).
"""
import sys
import os
import random
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "backend"))

from sheets.logger import _get_worksheet, REVIEW_HEADERS

# ── Config ─────────────────────────────────────────────────────────────────────
TOTAL_QUESTIONS     = 827
NUM_BATCHES         = 21
START_DATE          = datetime(2026, 4, 10, 8, 0, 0, tzinfo=timezone.utc)
END_DATE            = datetime(2026, 5, 11, 18, 0, 0, tzinfo=timezone.utc)

QUESTION_TYPES = [
    "MCQ", "MCQ", "MCQ", "MCQ",
    "Fill in the Blanks", "Fill in the Blanks",
    "Audio Based MCQ",
    "Image Based with Options",
    "Textual",
    "Prompt Based",
]
DIFFICULTIES    = ["Easy", "Medium", "Medium", "Hard", "Medium"]
CORRECT_ANSWERS = ["A", "B", "C", "D", "A", "B", "C"]

RUBRIC_SHEET_COLS = [
    "R1 Grammar", "R2 Spelling", "R3 Ambiguity", "R4 Alignment",
    "R5 Instructions", "R6 Academic Lang", "R7 Options/Exp",
    "R8 Readability", "R9 Formatting", "R10 Punctuation", "R11 EN Consistency",
]

# Distribution: 601 clean, 154 minor, 36 needs_review, 29 rejected, 7 failed = 827
DISTRIBUTION = (
    ["approved_clean"] * 601 +
    ["approved_minor"] * 154 +
    ["needs_review"]   * 36 +
    ["rejected"]       * 29 +
    ["failed"]         * 7
)
random.shuffle(DISTRIBUTION)

# Batch sizes that sum exactly to 827 across 21 batches
BATCH_SIZES = [32, 45, 38, 52, 29, 41, 48, 35, 56, 27, 43, 39, 51, 34, 47, 28, 44, 36, 53, 31]
BATCH_SIZES.append(TOTAL_QUESTIONS - sum(BATCH_SIZES))  # last batch = 18

assert sum(BATCH_SIZES) == TOTAL_QUESTIONS, f"Batch sizes sum to {sum(BATCH_SIZES)}, expected {TOTAL_QUESTIONS}"
assert len(BATCH_SIZES) == NUM_BATCHES, f"Expected {NUM_BATCHES} batches, got {len(BATCH_SIZES)}"


def random_ts():
    span = int((END_DATE - START_DATE).total_seconds())
    offset = random.randint(0, span)
    dt = START_DATE + timedelta(seconds=offset)
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC"), dt


def make_rubric_row(status_type: str):
    """Return (rubric_scores list of 11, overall_status, remarks)."""
    if status_type == "approved_clean":
        scores = ["Pass"] * 11
        return scores, "Approved", "No issues found."

    if status_type == "approved_minor":
        scores = ["Pass"] * 11
        for i in random.sample(range(11), random.randint(1, 2)):
            scores[i] = "Minor"
        rubric_names = [RUBRIC_SHEET_COLS[i] for i, s in enumerate(scores) if s == "Minor"]
        remarks = " | ".join(f"[{r} - Minor] Minor correction applied." for r in rubric_names)
        return scores, "Approved", remarks

    if status_type == "needs_review":
        scores = ["Pass"] * 11
        idx = random.randint(0, 10)
        scores[idx] = "Major"
        # optionally also a minor
        if random.random() > 0.5:
            other = (idx + random.randint(1, 10)) % 11
            scores[other] = "Minor"
        remarks = f"[{RUBRIC_SHEET_COLS[idx]} - Major] Issue requires revision."
        return scores, "Needs Review", remarks

    if status_type == "rejected":
        scores = ["Pass"] * 11
        idx = random.randint(0, 10)
        scores[idx] = "Critical"
        remarks = f"[{RUBRIC_SHEET_COLS[idx]} - Critical] Critical issue found — question rejected."
        return scores, "Rejected", remarks

    # failed
    return [""] * 11, "Review Failed", "Review pipeline error."


SAMPLE_QUESTIONS = [
    "Which of the following best describes photosynthesis?",
    "The mitochondria is the ___ of the cell.",
    "What is the correct formula for calculating velocity?",
    "Which author wrote 'Pride and Prejudice'?",
    "Identify the grammatically correct sentence.",
    "Select the word that is closest in meaning to 'ephemeral'.",
    "What does the graph above illustrate about population growth?",
    "Based on the passage, what is the main argument?",
    "Which of the following is NOT a prime number?",
    "What is the capital city of Brazil?",
    "The water cycle involves evaporation, condensation, and ___ .",
    "Which enzyme breaks down carbohydrates in the mouth?",
    "What type of bond is formed between two non-metal atoms?",
    "Rearrange the following sentence into the correct order.",
    "Which statement about Newton's third law is accurate?",
]

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f"[SEED] Connecting to Google Sheets...")
    ws = _get_worksheet("Reviews", REVIEW_HEADERS)

    # Sort batches by a random date so chronological order looks natural
    batch_dates = sorted([random_ts() for _ in range(NUM_BATCHES)], key=lambda x: x[1])

    idx = 0
    for batch_num, (batch_size, (ts_str, batch_dt)) in enumerate(zip(BATCH_SIZES, batch_dates)):
        job_id = str(uuid.uuid4())[:8]
        rows = []
        for q_i in range(batch_size):
            q_no   = f"Q{q_i + 1:03d}"
            qtype  = random.choice(QUESTION_TYPES)
            diff   = random.choice(DIFFICULTIES)
            ans    = random.choice(CORRECT_ANSWERS)
            question_text = random.choice(SAMPLE_QUESTIONS)
            status_type = DISTRIBUTION[idx]
            idx += 1

            rubric_scores, overall_status, remarks = make_rubric_row(status_type)

            rows.append([
                ts_str,
                job_id,
                q_no,
                qtype,
                question_text,
                ans,
                diff,
                overall_status,
                *rubric_scores,
                remarks[:500],
            ])

        ws.append_rows(rows, value_input_option="RAW")
        date_label = batch_dt.strftime("%Y-%m-%d")
        print(f"[SEED] Batch {batch_num + 1:02d}/{NUM_BATCHES}  job={job_id}  date={date_label}  questions={batch_size}  total_so_far={idx}")

    print(f"\n[SEED] Done. {TOTAL_QUESTIONS} questions seeded across {NUM_BATCHES} jobs.")
    print("[SEED] The Performance Dashboard will reflect this data within 5 minutes (TTL cache).")
    print("[SEED] Or restart the backend to force an immediate refresh.")


if __name__ == "__main__":
    main()
