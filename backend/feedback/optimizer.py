import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import dspy
from config import configure_dspy
from .store import get_training_examples
from pipeline.modules import RubricReviewer, OPTIMIZED_PATH
from sheets.logger import get_training_feedback_from_sheets, save_optimized_weights

MIN_EXAMPLES = 3

# Maps rubric name → which batch predictor it belongs to + prefix
RUBRIC_BATCH_MAP = {
    "R1_Grammatical_Accuracy":        ("mq_text",     "r1"),
    "R2_Spelling":                    ("mq_text",     "r2"),
    "R10_Punctuation":                ("mq_text",     "r10"),
    "R11_EN_Consistency":             ("mq_text",     "r11"),
    "R4_Functionality_Alignment":     ("mq_content",  "r4"),
    "R5_Instruction_Clarity":         ("mq_content",  "r5"),
    "R6_Academic_Language":           ("mq_content",  "r6"),
    "R8_Readability":                 ("mq_content",  "r8"),
    "R7_Option_Explanation_Consistency": ("mq_structure", "r7"),
    "R9_Formatting_Spacing":          ("mq_structure", "r9"),
    "R3_Ambiguity":                   ("mq_ambiguity", "r3"),
}

BATCH_DEFAULT_SCORES = {
    "mq_text":      {"r1_score":"Pass","r1_issues":"None","r1_corrected_question":"",
                     "r2_score":"Pass","r2_issues":"None","r2_corrected_question":"",
                     "r10_score":"Pass","r10_issues":"None","r10_corrected_question":"",
                     "r11_score":"Pass","r11_issues":"None","r11_corrected_question":""},
    "mq_content":   {"r4_score":"Pass","r4_issues":"None",
                     "r5_score":"Pass","r5_issues":"None","r5_corrected_instructions":"",
                     "r6_score":"Pass","r6_issues":"None","r6_corrected_question":"",
                     "r8_score":"Pass","r8_issues":"None","r8_corrected_question":""},
    "mq_structure": {"r7_score":"Pass","r7_issues":"None","r7_corrected_explanation":"","r7_corrected_options":"",
                     "r9_score":"Pass","r9_issues":"None","r9_corrected_options":"","r9_corrected_question":""},
    "mq_ambiguity": {"r3_score":"Pass","r3_issues":"None","r3_corrected_question":"",
                     "r3_corrected_instructions":"","r3_corrected_options":""},
}


def _build_batch_examples(records: list) -> dict:
    """
    Convert individual feedback records into per-batch DSPy Examples.
    Returns {batch_name: [dspy.Example, ...]}
    """
    from collections import defaultdict

    # Group: batch_name → list of (question_json_obj, result_patch)
    batch_data = defaultdict(list)

    for rec in records:
        rubric = rec.get("rubric_name", "")
        if rubric not in RUBRIC_BATCH_MAP:
            continue
        batch_name, prefix = RUBRIC_BATCH_MAP[rubric]

        original = rec.get("original_text", "").strip()
        if not original:
            continue

        q_no = rec.get("question_no", "Q001")
        verdict = rec.get("user_verdict", "accept")
        ai_score = rec.get("ai_score", "Pass")
        user_correction = rec.get("user_correction", "") or ""
        user_comment = rec.get("user_comment", "") or ""

        # Determine the expected score
        if verdict == "accept":
            expected_score = ai_score
        elif verdict == "reject":
            expected_score = "Pass"
        else:  # override
            expected_score = ai_score

        q_obj = {
            "q_no": q_no,
            "question": original,
            "task_instructions": "",
            "options": "",
            "explanation": "",
            "transcript": "",
            "question_type": "MCQ",
            "correct_answer": "",
            "difficulty": "",
            "question_purpose": "",
            "question_schema": "",
        }

        result_patch = {
            f"{prefix}_score": expected_score,
            f"{prefix}_issues": user_comment or user_correction or "None",
        }

        batch_data[batch_name].append((q_obj, result_patch, q_no))

    # Build dspy.Example per batch
    examples_by_batch = defaultdict(list)
    for batch_name, items in batch_data.items():
        for q_obj, patch, q_no in items:
            result = {**BATCH_DEFAULT_SCORES[batch_name], "q_no": q_no, **patch}
            ex = dspy.Example(
                questions_json=json.dumps([q_obj]),
                results_json=json.dumps([result]),
            ).with_inputs("questions_json")
            examples_by_batch[batch_name].append(ex)

    return dict(examples_by_batch)


def _score_metric(example, pred, trace=None):
    """Check if the predicted results_json contains the expected score."""
    try:
        expected = json.loads(getattr(example, "results_json", "[]"))
        predicted = json.loads(getattr(pred, "results_json", "[]"))
        if not expected or not predicted:
            return False
        for key, val in expected[0].items():
            if key.endswith("_score") and predicted[0].get(key) != val:
                return False
        return True
    except Exception:
        return False


BATCH_LABELS = {
    "mq_text":      "Text Mechanics (Grammar, Spelling, Punctuation, EN)",
    "mq_content":   "Content Quality (Alignment, Instructions, Academic, Readability)",
    "mq_structure": "Structure (Options/Explanation, Formatting)",
    "mq_ambiguity": "Ambiguity",
}


def _read_demos(path: str) -> dict:
    """Read current few-shot demos from saved module JSON. Returns {batch: [demo, ...]}"""
    if not os.path.exists(path):
        return {}
    try:
        with open(path) as f:
            data = json.load(f)
        out = {}
        for batch in BATCH_LABELS:
            predictor = data.get("predict", {}).get(batch) or data.get(batch, {})
            demos = predictor.get("demos", [])
            parsed = []
            for d in demos:
                try:
                    q = json.loads(d.get("questions_json", "[]"))
                    r = json.loads(d.get("results_json", "[]"))
                    parsed.append({
                        "question": q[0].get("question", "")[:200] if q else "",
                        "scores": {k: v for k, v in (r[0].items() if r else {}) if k.endswith("_score")},
                    })
                except Exception:
                    continue
            out[batch] = parsed
        return out
    except Exception:
        return {}


def optimize_all_rubrics() -> list:
    configure_dspy()

    # Merge feedback from Google Sheets (permanent) + local SQLite (current session)
    sheets_records = get_training_feedback_from_sheets()
    local_records = get_training_examples()

    # Deduplicate by (question_no, rubric_name) — Sheets takes priority
    seen = {(r["question_no"], r["rubric_name"]) for r in sheets_records}
    for r in local_records:
        key = (r.get("question_no"), r.get("rubric_name"))
        if key not in seen:
            sheets_records.append(r)
            seen.add(key)
    all_records = sheets_records

    if len(all_records) < MIN_EXAMPLES:
        return [{
            "status": "skipped",
            "reason": f"Only {len(all_records)} feedback records (need {MIN_EXAMPLES}+). "
                      "Submit more reject/override feedback first.",
        }]

    examples_by_batch = _build_batch_examples(all_records)
    if not examples_by_batch:
        return [{"status": "skipped", "reason": "No usable feedback examples found."}]

    # Capture BEFORE state
    before_demos = _read_demos(OPTIMIZED_PATH)

    reviewer = RubricReviewer()
    results = []

    BATCH_ATTR = {
        "mq_text": "mq_text",
        "mq_content": "mq_content",
        "mq_structure": "mq_structure",
        "mq_ambiguity": "mq_ambiguity",
    }

    for batch_name, examples in examples_by_batch.items():
        if len(examples) < MIN_EXAMPLES:
            results.append({
                "status": "skipped",
                "batch": batch_name,
                "reason": f"Only {len(examples)} examples (need {MIN_EXAMPLES}+)",
            })
            continue

        predictor = getattr(reviewer, BATCH_ATTR[batch_name])
        try:
            teleprompter = dspy.BootstrapFewShot(
                metric=_score_metric,
                max_bootstrapped_demos=3,
                max_labeled_demos=8,
                max_rounds=1,
            )
            optimized_predictor = teleprompter.compile(predictor, trainset=examples)
            setattr(reviewer, BATCH_ATTR[batch_name], optimized_predictor)
            results.append({
                "status": "success",
                "batch": batch_name,
                "examples_used": len(examples),
            })
        except Exception as e:
            results.append({"status": "error", "batch": batch_name, "reason": str(e)})

    # Save to local file
    os.makedirs(os.path.dirname(OPTIMIZED_PATH), exist_ok=True)
    try:
        reviewer.save(OPTIMIZED_PATH)
        print(f"[INFO] Saved optimized reviewer to {OPTIMIZED_PATH}")
        save_optimized_weights(OPTIMIZED_PATH)
    except Exception as e:
        print(f"[WARN] Could not save optimized module: {e}")

    # Capture AFTER state and build diff
    after_demos = _read_demos(OPTIMIZED_PATH)
    prompt_diff = []
    for batch, label in BATCH_LABELS.items():
        before = before_demos.get(batch, [])
        after  = after_demos.get(batch, [])
        before_qs = {d["question"] for d in before}
        after_qs  = {d["question"] for d in after}
        added   = [d for d in after  if d["question"] not in before_qs]
        removed = [d for d in before if d["question"] not in after_qs]
        kept    = [d for d in after  if d["question"] in before_qs]
        prompt_diff.append({
            "batch": batch,
            "label": label,
            "before_count": len(before),
            "after_count":  len(after),
            "added":   added,
            "removed": removed,
            "kept":    kept,
        })

    return {"results": results, "prompt_diff": prompt_diff}


# Keep for backward compat
def optimize_rubric(rubric_name: str) -> dict:
    results = optimize_all_rubrics()
    return results[0] if results else {"status": "skipped"}
