import sys
import os

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

SCORE_SEVERITY = {"Critical": 4, "Major": 3, "Minor": 2, "Pass": 1, "N/A": 0}


def compute_overall_status(rubric_results: dict) -> str:
    scores = [v.get("score", "Pass") for v in rubric_results.values()]
    if "Critical" in scores:
        return "Rejected"
    if "Major" in scores:
        return "Needs Review"
    return "Approved"


def review_dataframe(df, progress_callback=None) -> list:
    configure_dspy()
    reviewer = RubricReviewer()
    results = []
    total = len(df)

    for i, (_, row) in enumerate(df.iterrows()):
        q_no = str(row.get("Q. NO", i + 1))

        if progress_callback:
            progress_callback(i, total, q_no)

        try:
            result = _review_single_question(reviewer, row)
        except Exception as e:
            result = _make_failed_result(row, str(e))

        results.append(result)

    if progress_callback:
        progress_callback(total, total, "Complete")

    return results


def _review_single_question(reviewer: RubricReviewer, row) -> dict:
    q_type = str(row.get("Question Type", ""))
    options = str(row.get("Options", ""))
    question = str(row.get("Question", ""))
    instructions = str(row.get("Instructions", ""))
    explanation = str(row.get("Explanation", ""))
    transcript = str(row.get("Transcript", ""))
    correct_answer = str(row.get("Correct Answer", ""))
    question_purpose = str(row.get("Question Purpose", ""))
    difficulty = str(row.get("Difficulty", ""))
    schema = str(row.get("Schema", ""))

    applicable = get_rubrics_for_question(q_type, options)
    rubric_results = {}

    if 1 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r1,
            question=question, task_instructions=instructions,
            options=options, explanation=explanation,
            transcript=transcript, question_type=q_type,
        )
        rubric_results[1] = _extract(res)

    if 2 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r2,
            question=question, task_instructions=instructions,
            options=options, explanation=explanation,
            transcript=transcript,
        )
        rubric_results[2] = _extract(res)

    if 3 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r3,
            question=question, options=options,
            correct_answer=correct_answer, task_instructions=instructions,
            question_type=q_type, question_purpose=question_purpose,
        )
        rubric_results[3] = _extract(res)

    if 4 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r4,
            question=question, question_purpose=question_purpose,
            correct_answer=correct_answer, explanation=explanation,
            difficulty=difficulty, question_type=q_type,
        )
        rubric_results[4] = _extract(res)

    if 5 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r5,
            task_instructions=instructions, question_type=q_type,
            difficulty=difficulty, question=question,
        )
        rubric_results[5] = _extract(res)

    if 6 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r6,
            question=question, task_instructions=instructions,
            options=options, explanation=explanation,
            difficulty=difficulty,
        )
        rubric_results[6] = _extract(res)

    if 7 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r7,
            options=options, correct_answer=correct_answer,
            explanation=explanation, question=question,
            question_type=q_type,
        )
        rubric_results[7] = _extract(res)

    if 8 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r8,
            question=question, task_instructions=instructions,
            explanation=explanation, difficulty=difficulty,
        )
        rubric_results[8] = _extract(res)

    if 9 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r9,
            question=question, options=options,
            task_instructions=instructions, question_schema=schema,
        )
        rubric_results[9] = _extract(res)

    if 10 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r10,
            question=question, task_instructions=instructions,
            options=options, explanation=explanation,
            transcript=transcript,
        )
        rubric_results[10] = _extract(res)

    if 11 in applicable:
        res = reviewer.call_with_retry(
            reviewer.r11,
            question=question, task_instructions=instructions,
            options=options, explanation=explanation,
            transcript=transcript,
        )
        rubric_results[11] = _extract(res)

    row_dict = dict(row)
    corrections = apply_corrections(rubric_results, row_dict)
    remarks = generate_remarks(rubric_results, row_dict)
    overall_status = compute_overall_status(rubric_results)

    result = {
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


def _extract(prediction) -> dict:
    if prediction is None:
        return {"score": "Pass", "issues": "None"}
    if hasattr(prediction, "__dict__"):
        return {k: v for k, v in vars(prediction).items() if not k.startswith("_")}
    return dict(prediction)


def _make_failed_result(row, error_msg: str) -> dict:
    result = {
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
