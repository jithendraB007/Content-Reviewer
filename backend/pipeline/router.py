ALL_RUBRICS = set(range(1, 12))
NO_R7 = ALL_RUBRICS - {7}

ROUTING_MAP = {
    "MCQ": ALL_RUBRICS,
    "Fill in the Blanks": NO_R7,
    "Speaking Based": NO_R7,
    "Textual": NO_R7,
    "Audio Based MCQ": ALL_RUBRICS,
    "Prompt Based": NO_R7,
    "Image Based with Options": ALL_RUBRICS,
    "Image Based with Audio": NO_R7,
}


def get_rubrics_for_question(question_type: str, options: str) -> set:
    rubrics = ROUTING_MAP.get(question_type, NO_R7).copy()
    if question_type == "Prompt Based" and options and str(options).strip():
        rubrics.add(7)
    return rubrics
