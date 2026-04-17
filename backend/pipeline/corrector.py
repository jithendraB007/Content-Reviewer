SEVERITY_ORDER = {"Critical": 4, "Major": 3, "Minor": 2, "Pass": 1, "N/A": 0, "": 0}

OUTPUT_FIELDS = [
    "corrected_question",
    "corrected_instructions",
    "corrected_options",
    "corrected_explanation",
    "corrected_transcript",
]

FIELD_TO_COLUMN = {
    "corrected_question": "Corrected_Question",
    "corrected_instructions": "Corrected_Instructions",
    "corrected_options": "Corrected_Options",
    "corrected_explanation": "Corrected_Explanation",
    "corrected_transcript": "Corrected_Transcript",
}


def apply_corrections(rubric_results: dict, original_row: dict = None) -> dict:
    """
    rubric_results: {rubric_num (int): {"score": str, "corrected_question": str, ...}}
    Returns: {"Corrected_Question": str, "Corrected_Instructions": str, ...}
    When multiple rubrics correct the same field, the highest-severity one wins.
    Falls back to original text if no rubric produced a correction.
    """
    best = {}

    for rubric_num, result in rubric_results.items():
        score = result.get("score", "Pass")
        severity = SEVERITY_ORDER.get(score, 0)

        for field in OUTPUT_FIELDS:
            corrected = result.get(field, "")
            if not corrected or corrected.strip() == "":
                continue

            col_name = FIELD_TO_COLUMN[field]
            current_severity, _ = best.get(col_name, (0, ""))
            if severity > current_severity:
                best[col_name] = (severity, corrected)

    result_dict = {}
    for col_name in FIELD_TO_COLUMN.values():
        if col_name in best:
            result_dict[col_name] = best[col_name][1]
        elif original_row:
            orig_key = col_name.replace("Corrected_", "")
            orig_val = original_row.get(orig_key, "")
            result_dict[col_name] = orig_val
        else:
            result_dict[col_name] = ""

    return result_dict
