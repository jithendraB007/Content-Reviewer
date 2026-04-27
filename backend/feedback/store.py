import sqlite3
import uuid
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "feedback.db")


def _conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def _ensure_table():
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                question_no TEXT NOT NULL,
                rubric_name TEXT NOT NULL,
                ai_score TEXT NOT NULL,
                ai_correction TEXT,
                user_verdict TEXT NOT NULL,
                user_correction TEXT,
                user_comment TEXT,
                original_text TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        con.execute("CREATE INDEX IF NOT EXISTS idx_job ON feedback(job_id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_verdict ON feedback(user_verdict)")
        con.commit()


_ensure_table()


def insert_feedback(data: dict) -> dict:
    record = {k: v for k, v in data.items()}
    record["id"] = str(uuid.uuid4())
    record["created_at"] = datetime.now(timezone.utc).isoformat()
    record.pop("id", None)  # let us set it
    row_id = str(uuid.uuid4())

    with _conn() as con:
        con.execute("""
            INSERT INTO feedback
                (id, job_id, question_no, rubric_name, ai_score, ai_correction,
                 user_verdict, user_correction, user_comment, original_text, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            row_id,
            record.get("job_id", ""),
            record.get("question_no", ""),
            record.get("rubric_name", ""),
            record.get("ai_score", ""),
            record.get("ai_correction"),
            record.get("user_verdict", ""),
            record.get("user_correction"),
            record.get("user_comment"),
            record.get("original_text"),
            record.get("created_at", ""),
        ))
        con.commit()
    return {"id": row_id, **record}


def get_training_examples(rubric_name: str = None) -> list:
    with _conn() as con:
        if rubric_name:
            rows = con.execute(
                "SELECT * FROM feedback WHERE user_verdict IN ('reject','override') AND rubric_name=?",
                (rubric_name,)
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM feedback WHERE user_verdict IN ('reject','override')"
            ).fetchall()
    return [dict(r) for r in rows]


def get_feedback_by_job(job_id: str) -> list:
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM feedback WHERE job_id=? ORDER BY created_at DESC",
            (job_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_feedback_stats() -> dict:
    with _conn() as con:
        rows = con.execute("SELECT user_verdict FROM feedback").fetchall()
    stats = {"accept": 0, "reject": 0, "override": 0, "total": len(rows)}
    for row in rows:
        v = row["user_verdict"]
        if v in stats:
            stats[v] += 1
    return stats
