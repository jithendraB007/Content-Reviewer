import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import init_supabase, supabase as _supabase_ref
import config
from .models import FEEDBACK_TABLE


def _client():
    if config.supabase is None:
        init_supabase()
    return config.supabase


def insert_feedback(data: dict) -> dict:
    payload = {k: v for k, v in data.items() if k != "id"}
    result = _client().table(FEEDBACK_TABLE).insert(payload).execute()
    return result.data[0] if result.data else {}


def get_training_examples(rubric_name: str = None) -> list:
    q = (
        _client()
        .table(FEEDBACK_TABLE)
        .select("*")
        .in_("user_verdict", ["reject", "override"])
    )
    if rubric_name:
        q = q.eq("rubric_name", rubric_name)
    result = q.execute()
    return result.data or []


def get_feedback_by_job(job_id: str) -> list:
    result = (
        _client()
        .table(FEEDBACK_TABLE)
        .select("*")
        .eq("job_id", job_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_feedback_stats() -> dict:
    result = _client().table(FEEDBACK_TABLE).select("user_verdict").execute()
    rows = result.data or []
    stats = {"accept": 0, "reject": 0, "override": 0, "total": len(rows)}
    for row in rows:
        verdict = row.get("user_verdict", "")
        if verdict in stats:
            stats[verdict] += 1
    return stats
