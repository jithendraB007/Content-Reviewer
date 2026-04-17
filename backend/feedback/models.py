"""
Supabase table schema for feedback storage.

Run the following SQL in your Supabase project's SQL Editor (Dashboard → SQL Editor):

    create table if not exists feedback (
      id uuid primary key default gen_random_uuid(),
      job_id text not null,
      question_no text not null,
      rubric_name text not null,
      ai_score text not null,
      ai_correction text,
      user_verdict text not null check (user_verdict in ('accept', 'reject', 'override')),
      user_correction text,
      user_comment text,
      original_text text,
      created_at timestamptz default now()
    );

    create index if not exists idx_feedback_job_id on feedback(job_id);
    create index if not exists idx_feedback_verdict on feedback(user_verdict);
    create index if not exists idx_feedback_rubric on feedback(rubric_name);
"""

FEEDBACK_TABLE = "feedback"

FEEDBACK_FIELDS = (
    "id",
    "job_id",
    "question_no",
    "rubric_name",
    "ai_score",
    "ai_correction",
    "user_verdict",
    "user_correction",
    "user_comment",
    "original_text",
    "created_at",
)
