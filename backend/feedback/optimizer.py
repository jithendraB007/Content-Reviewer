import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import dspy
from config import configure_dspy
from .store import get_training_examples
from pipeline.signatures import (
    GrammaticalAccuracy,
    SpellingCheck,
    AmbiguityCheck,
    FunctionalityAlignment,
    InstructionClarity,
    AcademicLanguage,
    OptionExplanationConsistency,
    ReadabilityCheck,
    FormattingSpacing,
    PunctuationCheck,
    ENConsistency,
)

RUBRIC_SIGNATURE_MAP = {
    "R1_Grammatical_Accuracy": GrammaticalAccuracy,
    "R2_Spelling": SpellingCheck,
    "R3_Ambiguity": AmbiguityCheck,
    "R4_Functionality_Alignment": FunctionalityAlignment,
    "R5_Instruction_Clarity": InstructionClarity,
    "R6_Academic_Language": AcademicLanguage,
    "R7_Option_Explanation_Consistency": OptionExplanationConsistency,
    "R8_Readability": ReadabilityCheck,
    "R9_Formatting_Spacing": FormattingSpacing,
    "R10_Punctuation": PunctuationCheck,
    "R11_EN_Consistency": ENConsistency,
}

OPTIMIZED_DIR = os.path.join(os.path.dirname(__file__), "..", "optimized")
MIN_EXAMPLES_REQUIRED = 3


def build_training_examples(rubric_name: str) -> list:
    records = get_training_examples(rubric_name=rubric_name)
    examples = []

    for rec in records:
        if not rec.get("original_text"):
            continue

        expected_score = rec.get("ai_score", "Minor")
        if rec.get("user_verdict") == "override" and rec.get("user_correction"):
            expected_issues = rec.get("user_comment") or rec.get("user_correction", "")
        else:
            expected_issues = rec.get("user_comment", "")

        ex = dspy.Example(
            question=rec.get("original_text", ""),
            task_instructions="",
            options="",
            explanation="",
            transcript="",
            question_type="MCQ",
            score=expected_score,
            issues=expected_issues,
        ).with_inputs("question", "task_instructions", "options", "explanation", "transcript", "question_type")

        examples.append(ex)

    return examples


def score_metric(example, pred, trace=None):
    return getattr(example, "score", None) == getattr(pred, "score", None)


def optimize_rubric(rubric_name: str) -> dict:
    configure_dspy()

    examples = build_training_examples(rubric_name)
    if len(examples) < MIN_EXAMPLES_REQUIRED:
        return {
            "status": "skipped",
            "rubric": rubric_name,
            "reason": f"Only {len(examples)} training examples (need {MIN_EXAMPLES_REQUIRED}+)",
        }

    signature_cls = RUBRIC_SIGNATURE_MAP.get(rubric_name)
    if not signature_cls:
        return {"status": "error", "rubric": rubric_name, "reason": f"Unknown rubric: {rubric_name}"}

    try:
        teleprompter = dspy.BootstrapFewShot(
            metric=score_metric,
            max_bootstrapped_demos=4,
            max_labeled_demos=16,
            max_rounds=1,
        )
        student = dspy.Predict(signature_cls)
        optimized = teleprompter.compile(student, trainset=examples)

        os.makedirs(OPTIMIZED_DIR, exist_ok=True)
        save_path = os.path.join(OPTIMIZED_DIR, f"{rubric_name}.json")
        optimized.save(save_path)

        return {
            "status": "success",
            "rubric": rubric_name,
            "examples_used": len(examples),
            "saved_to": save_path,
        }

    except Exception as e:
        return {"status": "error", "rubric": rubric_name, "reason": str(e)}


def optimize_all_rubrics() -> list:
    results = []
    for rubric_name in RUBRIC_SIGNATURE_MAP:
        result = optimize_rubric(rubric_name)
        results.append(result)
    return results
