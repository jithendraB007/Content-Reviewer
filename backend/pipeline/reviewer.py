import sys
import os
import json
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import configure_dspy
from .modules import RubricReviewer
from .router import get_rubrics_for_question
from .corrector import apply_corrections
from .remarks import generate_remarks

RUBRIC_OUTPUT_COLUMNS = {
    1: "R1_Grammatical_Accuracy",
    2: "R2_Spelling",
    3: "R3_Ambiguity",
    4: "R4_Functionality_Alignment",
    5: "R5_Instruction_Clarity",
    6: "R6_Academic_Language",
    7: "R7_Option_Explanation_Consistency",
    8: "R8_Readability",
    9: "R9_Formatting_Spacing",
    10: "R10_Punctuation",
    11: "R11_EN_Consistency",
}

BATCH_SIZE = 5


def compute_overall_status(rubric_results: dict) -> str:
    scores = [v.get("score", "Pass") for v in rubric_results.values()]
    if "Critical" in scores:
        return "Rejected"
    if "Major" in scores:
        return "Needs Review"
    if "Error" in scores:
        return "Needs Review"
    return "Approved"


def review_dataframe(df, progress_callback=None) -> list:
    configure_dspy()
    reviewer = RubricReviewer()
    results = []
    rows = list(df.iterrows())
    total = len(rows)

    for batch_start in range(0, total, BATCH_SIZE):
        batch = rows[batch_start: batch_start + BATCH_SIZE]

        if progress_callback:
            q_no = str(batch[0][1].get("Q. NO", batch_start + 1))
            progress_callback(batch_start, total, q_no)

        batch_results = _review_batch(reviewer, batch)
        results.extend(batch_results)

    if progress_callback:
        progress_callback(total, total, "Complete")

    return results


# ── JSON helpers ──────────────────────────────────────────────────────────────

def _parse_json_array(text: str) -> list | None:
    """Extract a JSON array from LLM output, handling markdown fences and extra text."""
    if not text:
        return None
    text = text.strip()

    # Strategy 1: direct parse
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except Exception:
        pass

    # Strategy 2: strip markdown code fence
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            result = json.loads(match.group(1))
            if isinstance(result, list):
                return result
        except Exception:
            pass

    # Strategy 3: find first [...] block
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            result = json.loads(match.group(0))
            if isinstance(result, list):
                return result
        except Exception:
            pass

    return None


def _rows_to_json(batch: list) -> str:
    """Serialize a batch of DataFrame rows to a JSON string for the LLM."""
    items = []
    for _, row in batch:
        items.append({
            "q_no": str(row.get("Q. NO", "")),
            "question": str(row.get("Question", "")),
            "task_instructions": str(row.get("Instructions", "")),
            "options": str(row.get("Options", "")),
            "explanation": str(row.get("Explanation", "")),
            "transcript": str(row.get("Transcript", "")),
            "question_type": str(row.get("Question Type", "")),
            "correct_answer": str(row.get("Correct Answer", "")),
            "difficulty": str(row.get("Difficulty", "")),
            "question_purpose": str(row.get("Question Purpose", "")),
            "question_schema": str(row.get("Schema", "")),
        })
    return json.dumps(items, ensure_ascii=False)


def _error_rubric_result(rubric_nums: list, msg: str) -> dict:
    return {n: {"score": "Error", "issues": msg[:100]} for n in rubric_nums}


# ── Batch review ──────────────────────────────────────────────────────────────

def _review_batch(reviewer: RubricReviewer, batch: list) -> list:
    """Review a batch of up to BATCH_SIZE questions. Returns one result dict per question."""
    questions_json = _rows_to_json(batch)
    n_questions = len(batch)

    # per-question rubric results: {q_no: {rubric_num: {score, issues, ...}}}
    all_rubric_results: dict[str, dict] = {
        str(row.get("Q. NO", i)): {} for i, (_, row) in enumerate(batch)
    }

    # Determine which rubrics apply per question
    applicable_map: dict[str, set] = {}
    for _, row in batch:
        q_no = str(row.get("Q. NO", ""))
        applicable_map[q_no] = get_rubrics_for_question(
            str(row.get("Question Type", "")),
            str(row.get("Options", "")),
        )

    def any_applicable(rubric_set: set) -> bool:
        return any(rubric_set & app for app in applicable_map.values())

    # ── Text Mechanics (R1, R2, R10, R11) ─────────────────────────────────────
    if any_applicable({1, 2, 10, 11}):
        try:
            res = reviewer.call_with_retry(reviewer.mq_text, questions_json=questions_json)
            parsed = _parse_json_array(getattr(res, "results_json", ""))
            _merge_batch_results(parsed, all_rubric_results, {1: "r1", 2: "r2", 10: "r10", 11: "r11"}, applicable_map)
        except Exception as e:
            print(f"  [TEXT BATCH ERROR] {str(e)[:120]}")
            for q_no, app in applicable_map.items():
                for n in {1, 2, 10, 11} & app:
                    all_rubric_results[q_no][n] = {"score": "Error", "issues": str(e)[:100]}

    # ── Content Quality (R4, R5, R6, R8) ──────────────────────────────────────
    if any_applicable({4, 5, 6, 8}):
        try:
            res = reviewer.call_with_retry(reviewer.mq_content, questions_json=questions_json)
            parsed = _parse_json_array(getattr(res, "results_json", ""))
            _merge_batch_results(parsed, all_rubric_results, {4: "r4", 5: "r5", 6: "r6", 8: "r8"}, applicable_map)
        except Exception as e:
            print(f"  [CONTENT BATCH ERROR] {str(e)[:120]}")
            for q_no, app in applicable_map.items():
                for n in {4, 5, 6, 8} & app:
                    all_rubric_results[q_no][n] = {"score": "Error", "issues": str(e)[:100]}

    # ── Structure (R7, R9) ─────────────────────────────────────────────────────
    if any_applicable({7, 9}):
        try:
            res = reviewer.call_with_retry(reviewer.mq_structure, questions_json=questions_json)
            parsed = _parse_json_array(getattr(res, "results_json", ""))
            _merge_batch_results(parsed, all_rubric_results, {7: "r7", 9: "r9"}, applicable_map)
        except Exception as e:
            print(f"  [STRUCTURE BATCH ERROR] {str(e)[:120]}")
            for q_no, app in applicable_map.items():
                for n in {7, 9} & app:
                    all_rubric_results[q_no][n] = {"score": "Error", "issues": str(e)[:100]}

    # ── Ambiguity R3 (ChainOfThought) ──────────────────────────────────────────
    if any_applicable({3}):
        try:
            res = reviewer.call_with_retry(reviewer.mq_ambiguity, questions_json=questions_json)
            parsed = _parse_json_array(getattr(res, "results_json", ""))
            _merge_batch_results(parsed, all_rubric_results, {3: "r3"}, applicable_map)
        except Exception as e:
            print(f"  [AMBIGUITY BATCH ERROR] {str(e)[:120]}")
            for q_no, app in applicable_map.items():
                if 3 in app:
                    all_rubric_results[q_no][3] = {"score": "Error", "issues": str(e)[:100]}

    # ── Build final result dicts ───────────────────────────────────────────────
    results = []
    for _, row in batch:
        q_no = str(row.get("Q. NO", ""))
        rubric_results = all_rubric_results.get(q_no, {})
        try:
            result = _build_result(row, rubric_results)
        except Exception as e:
            result = _make_failed_result(row, str(e))
        results.append(result)

    return results


def _merge_batch_results(
    parsed: list | None,
    all_rubric_results: dict,
    rubric_prefix_map: dict,  # {rubric_num: "r1"}
    applicable_map: dict,
):
    """Merge a parsed JSON array of per-question results into all_rubric_results."""
    if not parsed:
        return

    for item in parsed:
        if not isinstance(item, dict):
            continue
        q_no = str(item.get("q_no", ""))
        if q_no not in all_rubric_results:
            continue
        app = applicable_map.get(q_no, set())

        for rubric_num, prefix in rubric_prefix_map.items():
            if rubric_num not in app:
                continue
            score_key = f"{prefix}_score"
            issues_key = f"{prefix}_issues"
            score = str(item.get(score_key, "Pass")).strip().title()
            # Normalize score value
            if score not in ("Pass", "Minor", "Major", "Critical"):
                score = "Pass"
            rubric_dict = {
                "score": score,
                "issues": str(item.get(issues_key, "None")),
            }
            # Pull correction fields
            for field in ("corrected_question", "corrected_instructions",
                          "corrected_options", "corrected_explanation",
                          "corrected_transcript"):
                val = item.get(f"{prefix}_{field}", "")
                if val:
                    rubric_dict[field] = str(val)

            all_rubric_results[q_no][rubric_num] = rubric_dict


# ── Per-question result builder ───────────────────────────────────────────────

def _build_result(row, rubric_results: dict) -> dict:
    q_type = str(row.get("Question Type", ""))
    question = str(row.get("Question", ""))
    instructions = str(row.get("Instructions", ""))
    options = str(row.get("Options", ""))
    correct_answer = str(row.get("Correct Answer", ""))
    explanation = str(row.get("Explanation", ""))
    transcript = str(row.get("Transcript", ""))

    row_dict = dict(row)
    corrections = apply_corrections(rubric_results, row_dict)
    remarks = generate_remarks(rubric_results, row_dict)
    overall_status = compute_overall_status(rubric_results)

    result = {
        "Q. NO": row.get("Q. NO", ""),
        "Question Type": q_type,
        "Question": question,
        "Instructions": instructions,
        "Options": options,
        "Correct Answer": correct_answer,
        "Explanation": explanation,
        "Transcript": transcript,
        **corrections,
        "Overall_Status": overall_status,
        "Remarks": remarks,
    }

    for rubric_num, col_name in RUBRIC_OUTPUT_COLUMNS.items():
        if rubric_num in rubric_results:
            result[col_name] = rubric_results[rubric_num].get("score", "Pass")
        else:
            result[col_name] = "N/A"

    result["_rubric_details"] = rubric_results
    return result


def _make_failed_result(row, error_msg: str) -> dict:
    result = {
        "Q. NO": str(row.get("Q. NO", "")),
        "Question Type": str(row.get("Question Type", "")),
        "Question": str(row.get("Question", "")),
        "Instructions": str(row.get("Instructions", "")),
        "Options": str(row.get("Options", "")),
        "Correct Answer": str(row.get("Correct Answer", "")),
        "Explanation": str(row.get("Explanation", "")),
        "Transcript": str(row.get("Transcript", "")),
        "Corrected_Instructions": str(row.get("Instructions", "")),
        "Corrected_Question": str(row.get("Question", "")),
        "Corrected_Options": str(row.get("Options", "")),
        "Corrected_Explanation": str(row.get("Explanation", "")),
        "Corrected_Transcript": str(row.get("Transcript", "")),
        "Overall_Status": "Review Failed",
        "Remarks": f"[SYSTEM ERROR] Review pipeline failed: {error_msg}",
        "_rubric_details": {},
    }
    for col_name in RUBRIC_OUTPUT_COLUMNS.values():
        result[col_name] = "N/A"
    return result
