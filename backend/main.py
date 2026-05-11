import os
import json
import time
import uuid
import threading
from typing import Optional

from fastapi import FastAPI, BackgroundTasks, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import UPLOAD_DIR, init_supabase, configure_dspy
from excel.reader import read_and_validate
from excel.writer import write_output
from excel.template import generate_template
from pipeline.reviewer import review_dataframe
from feedback.store import (
    insert_feedback, get_feedback_by_job, get_feedback_stats,
    save_question_verdict, get_verdict_stats, get_verdicts_by_job,
    get_upload_stats, get_accuracy_report,
)
from feedback.optimizer import optimize_all_rubrics
from sheets.logger import log_job_results, log_feedback

app = FastAPI(title="Exam Content Reviewer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000",
                   os.environ.get("FRONTEND_URL", "")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

job_store: dict = {}
job_store_lock = threading.Lock()


@app.on_event("startup")
def on_startup():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    try:
        init_supabase()
    except Exception as e:
        print(f"Warning: Supabase init failed: {e}. Feedback features will be unavailable.")


def _update_job(job_id: str, **kwargs):
    with job_store_lock:
        if job_id in job_store:
            job_store[job_id].update(kwargs)


def _run_review_job(job_id: str, df, input_path: str):
    def on_progress(current: int, total: int, q_no: str):
        progress = int((current / total) * 100) if total > 0 else 0
        _update_job(
            job_id,
            current=current,
            total=total,
            current_question=str(q_no),
            progress=progress,
        )

    try:
        results = review_dataframe(df, on_progress)

        out_filename = f"reviewed_{job_id}.xlsx"
        out_path = os.path.join(UPLOAD_DIR, out_filename)
        write_output(df, results, out_path)

        serializable_results = []
        for r in results:
            clean = {k: v for k, v in r.items() if k != "_rubric_details"}
            serializable_results.append(clean)

        _update_job(
            job_id,
            status="done",
            results=serializable_results,
            output_path=out_path,
            progress=100,
        )
        log_job_results(job_id, serializable_results)

    except Exception as e:
        _update_job(job_id, status="failed", error=str(e))


@app.post("/api/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, detail="Only Excel files (.xlsx, .xls) are accepted")

    job_id = str(uuid.uuid4())
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    input_path = os.path.join(UPLOAD_DIR, f"input_{job_id}.xlsx")

    contents = await file.read()
    with open(input_path, "wb") as f:
        f.write(contents)

    df, errors = read_and_validate(input_path)
    if errors:
        os.remove(input_path)
        raise HTTPException(422, detail={"errors": errors})

    total = len(df)
    with job_store_lock:
        job_store[job_id] = {
            "status": "processing",
            "progress": 0,
            "total": total,
            "current": 0,
            "current_question": "",
            "results": None,
            "output_path": None,
            "error": None,
            "started_at": time.time(),
            "input_path": input_path,
        }

    background_tasks.add_task(_run_review_job, job_id, df, input_path)
    return {"job_id": job_id, "total_questions": total}


@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found")
    return {
        "job_id": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "current": job["current"],
        "total": job["total"],
        "current_question": job["current_question"],
        "elapsed_seconds": round(time.time() - job["started_at"], 1),
        "error": job.get("error"),
    }


@app.get("/api/results/{job_id}")
def get_results(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found")
    if job["status"] != "done":
        raise HTTPException(409, detail=f"Job not complete. Status: {job['status']}")
    return {"job_id": job_id, "results": job["results"]}


@app.get("/api/download/{job_id}")
def download_results(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found")
    if job["status"] != "done" or not job.get("output_path"):
        raise HTTPException(409, detail="Results not ready yet")
    return FileResponse(
        job["output_path"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"reviewed_{job_id}.xlsx",
    )


class FeedbackPayload(BaseModel):
    job_id: str
    question_no: str
    rubric_name: str
    ai_score: str
    ai_correction: Optional[str] = None
    user_verdict: str
    user_correction: Optional[str] = None
    user_comment: Optional[str] = None
    original_text: Optional[str] = None


@app.post("/api/feedback")
def submit_feedback(payload: FeedbackPayload):
    if payload.user_verdict not in ("accept", "reject", "override"):
        raise HTTPException(400, detail="user_verdict must be accept, reject, or override")
    try:
        data = payload.model_dump()
        record = insert_feedback(data)
        log_feedback(data)
        return {"status": "saved", "id": record.get("id")}
    except Exception as e:
        print(f"[FEEDBACK ERROR] {type(e).__name__}: {e}")
        raise HTTPException(500, detail=f"Failed to save feedback: {e}")


@app.post("/api/optimize")
def trigger_optimization():
    try:
        outcome = optimize_all_rubrics()
        return {
            "status": "complete",
            "results": outcome.get("results", outcome) if isinstance(outcome, dict) else outcome,
            "prompt_diff": outcome.get("prompt_diff") if isinstance(outcome, dict) else None,
        }
    except Exception as e:
        raise HTTPException(500, detail=f"Optimization failed: {e}")


@app.get("/api/optimize/preview")
def preview_optimized_prompt():
    """Return the current few-shot examples baked into the optimized prompts."""
    from pipeline.modules import OPTIMIZED_PATH
    if not os.path.exists(OPTIMIZED_PATH):
        return {"status": "not_optimized", "batches": []}
    try:
        with open(OPTIMIZED_PATH, "r") as f:
            data = json.load(f)
        batches = []
        batch_labels = {
            "mq_text":      "Text Mechanics (Grammar, Spelling, Punctuation, EN)",
            "mq_content":   "Content Quality (Alignment, Instructions, Academic, Readability)",
            "mq_structure": "Structure (Options/Explanation, Formatting)",
            "mq_ambiguity": "Ambiguity",
        }
        for key, label in batch_labels.items():
            predictor = data.get("predict", {}).get(key) or data.get(key, {})
            demos = predictor.get("demos", [])
            examples = []
            for d in demos:
                try:
                    q = json.loads(d.get("questions_json", "[]"))
                    r = json.loads(d.get("results_json", "[]"))
                    examples.append({
                        "question": q[0].get("question", "")[:200] if q else "",
                        "scores": {k: v for k, v in (r[0].items() if r else {}) if k.endswith("_score")},
                    })
                except Exception:
                    continue
            batches.append({"batch": key, "label": label, "example_count": len(demos), "examples": examples})
        return {"status": "optimized", "batches": batches}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/api/template")
def download_template():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    template_path = os.path.join(UPLOAD_DIR, "template.xlsx")
    generate_template(template_path)
    return FileResponse(
        template_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="exam_questions_template.xlsx",
    )


@app.get("/api/feedback/stats")
def feedback_stats():
    try:
        return get_feedback_stats()
    except Exception as e:
        raise HTTPException(500, detail=str(e))


class VerdictPayload(BaseModel):
    job_id: str
    question_no: str
    overall_status: Optional[str] = None
    verdict: str


@app.post("/api/question-verdict")
def submit_question_verdict(payload: VerdictPayload):
    if payload.verdict not in ("approve", "flag", "ignore"):
        raise HTTPException(400, detail="verdict must be approve, flag, or ignore")
    try:
        record = save_question_verdict(
            payload.job_id, payload.question_no,
            payload.overall_status or "", payload.verdict
        )
        return {"status": "saved", **record}
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/api/verdicts/{job_id}")
def get_job_verdicts(job_id: str):
    return get_verdicts_by_job(job_id)


@app.get("/api/stats")
def overall_stats():
    try:
        upload_stats = get_upload_stats(UPLOAD_DIR)
        verdict_stats = get_verdict_stats()
        accuracy = get_accuracy_report(UPLOAD_DIR)
        return {
            "review": upload_stats,
            "verdicts": verdict_stats,
            "accuracy": accuracy,
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
