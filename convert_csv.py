"""
Converts GRIT L1 CSV into the content-reviewer input Excel format.
Usage: python convert_csv.py <input.csv> [output.xlsx]
"""

import sys
import re
import pandas as pd

CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else "grit_input.csv"
OUT_PATH = sys.argv[2] if len(sys.argv) > 2 else "grit_reviewed_input.xlsx"


def map_question_type(row_type: str, instruction: str) -> str:
    instruction_lower = str(instruction).lower()
    if "listen" in instruction_lower or row_type.lower() == "listening":
        return "Audio Based MCQ"
    return "MCQ"


def format_options(raw: str) -> str:
    """Convert newline-separated options → 'A) x | B) y | C) z | D) w'."""
    if not raw or pd.isna(raw):
        return ""
    opts = [o.strip() for o in str(raw).split("\n") if o.strip()]
    labels = ["A", "B", "C", "D", "E"]
    return " | ".join(f"{labels[i]}) {opt}" for i, opt in enumerate(opts[:5]))


def extract_transcript_and_question(instruction: str, question: str, q_type: str):
    """
    For Audio Based MCQ: split 'Audio script: "..." Actual question?' into
    (transcript, question_only).
    """
    if q_type != "Audio Based MCQ":
        return "", question

    # Pattern: Audio script: "..." or 'Audio script: ...\n\nQuestion?'
    audio_match = re.search(
        r"Audio script:\s*[\"â€˜â€™]?(.*?)[\"â€˜â€™]?\s*(?:<br>|\\n|\n\n)(.*)",
        question,
        re.DOTALL | re.IGNORECASE,
    )
    if audio_match:
        transcript = audio_match.group(1).strip().strip("â€˜â€™\"'")
        q_text = audio_match.group(2).strip()
        return transcript, q_text

    # Fallback: look for the last sentence as the question
    lines = [l.strip() for l in re.split(r"<br>|\n", question) if l.strip()]
    if len(lines) >= 2:
        # Last line is likely the question; rest is the audio script
        return " ".join(lines[:-1]), lines[-1]

    return "", question


def fix_encoding(text: str) -> str:
    """Fix common mojibake from Windows-1252 read as Latin-1."""
    if not isinstance(text, str):
        return str(text) if not pd.isna(text) else ""
    replacements = {
        "â€œ": "“", "â€": "”",
        "â€˜": "‘", "â€™": "’",
        "â€"": "—", "â€"": "–",
        "Ã©": "é", "Ã ": "à", "Ã¨": "è",
        "â": "'",  # catches stray â sequences
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


# ── Read CSV ──────────────────────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH, encoding="utf-8-sig", keep_default_na=False)
print(f"Loaded {len(df)} rows from {CSV_PATH}")
print("Columns:", list(df.columns))

rows = []
for idx, row in df.iterrows():
    q_no = f"Q{idx + 1:03d}"
    instruction = fix_encoding(str(row.get("Instruction", "")))
    question_raw = fix_encoding(str(row.get("Question", "")))
    options_raw = fix_encoding(str(row.get("Options", "")))
    correct_answer = fix_encoding(str(row.get("Correct Answer", "")))
    explanation = fix_encoding(str(row.get("Explanation", "")))
    skills = fix_encoding(str(row.get("Skills Tested", "")))
    difficulty = str(row.get("Difficulty", ""))
    row_type = fix_encoding(str(row.get("Question Type", "MCQ")))

    q_type = map_question_type(row_type, instruction)
    options_fmt = format_options(options_raw)
    transcript, question_clean = extract_transcript_and_question(instruction, question_raw, q_type)

    rows.append({
        "Q. NO": q_no,
        "Question Type": q_type,
        "Transcript": transcript,
        "Instructions": instruction,
        "Question": question_clean,
        "Options": options_fmt,
        "Correct Answer": correct_answer,
        "Explanation": explanation,
        "Schema": "",
        "Question Purpose": skills,
        "Difficulty": difficulty,
        "Tags": row_type,   # original sub-type kept as tag
    })

out_df = pd.DataFrame(rows)

# ── Write Excel ───────────────────────────────────────────────────────────────
with pd.ExcelWriter(OUT_PATH, engine="openpyxl") as writer:
    out_df.to_excel(writer, index=False, sheet_name="Questions")
    ws = writer.sheets["Questions"]
    # Auto-width columns
    for col in ws.columns:
        max_len = max((len(str(cell.value)) if cell.value else 0) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 60)

print(f"Written {len(out_df)} rows → {OUT_PATH}")
print("\nQuestion Type distribution:")
print(out_df["Question Type"].value_counts().to_string())
