RUBRIC_DISPLAY_NAMES = {
    1: "GRAMMAR",
    2: "SPELLING",
    3: "AMBIGUITY",
    4: "FUNCTIONALITY_ALIGNMENT",
    5: "INSTRUCTION_CLARITY",
    6: "ACADEMIC_LANGUAGE",
    7: "OPTION_EXPLANATION_CONSISTENCY",
    8: "READABILITY",
    9: "FORMATTING_SPACING",
    10: "PUNCTUATION",
    11: "EN_CONSISTENCY",
}

SEVERITY_PRIORITY = {"Critical": 4, "Major": 3, "Minor": 2, "Pass": 1, "N/A": 0, "Error": 0, "": 0}


def generate_remarks(rubric_results: dict, original_row: dict = None) -> str:
    """
    Generates the Remarks string.
    Format per issue:
      [RUBRIC_NAME - SEVERITY] Description. Original: "x" → Corrected: "y". Reason: why.
    Rubrics with Pass or N/A are omitted.
    Multiple issues separated by newlines.
    """
    parts = []

    for rubric_num in sorted(rubric_results.keys()):
        result = rubric_results[rubric_num]
        score = result.get("score", "Pass")

        if score in ("Pass", "N/A", "", "Error"):
            continue

        name = RUBRIC_DISPLAY_NAMES.get(rubric_num, f"R{rubric_num}")
        issues = result.get("issues", "").strip()
        if not issues or issues.lower() == "none":
            issues = "Issues detected"

        original_text = ""
        corrected_text = ""

        if original_row:
            for orig_field, corr_field in [
                ("Question", "corrected_question"),
                ("Instructions", "corrected_instructions"),
            ]:
                orig = str(original_row.get(orig_field, "")).strip()
                corr = str(result.get(corr_field, "")).strip()
                if orig and corr and orig != corr:
                    original_text = orig[:100]
                    corrected_text = corr[:100]
                    break

        if original_text and corrected_text:
            part = (
                f'[{name} - {score}] {issues}. '
                f'Original: "{original_text}" → Corrected: "{corrected_text}". '
                f'Reason: {issues}.'
            )
        else:
            part = f'[{name} - {score}] {issues}.'

        parts.append(part)

    return "\n".join(parts) if parts else "No issues found."
