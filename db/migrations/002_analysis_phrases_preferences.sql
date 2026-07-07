-- 002 — transcript analysis, saved phrases, user preferences
-- Run in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- Idempotent: safe to run twice.

-- Post-session analysis outputs (written by the agent's analysis job).
alter table sessions
  add column if not exists title text,
  add column if not exists preview text,
  add column if not exists word_count integer,
  add column if not exists correction_count integer;

-- Per-turn gentle correction, e.g. {"from": "I buyed", "to": "I bought"}.
alter table transcripts
  add column if not exists correction jsonb;

-- Onboarding answers (level/topic) — served by GET /me/preferences and
-- injected into the agent's system prompt.
alter table users
  add column if not exists level text,
  add column if not exists topic text;

-- Saved phrases (bookmarks from transcripts/corrections).
create table if not exists phrases (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  phrase text not null,
  note text,
  tag text,
  created_at timestamptz not null default now()
);

create index if not exists phrases_user_created_idx
  on phrases (user_id, created_at desc);
