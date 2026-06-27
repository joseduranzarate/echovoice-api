-- Echo — initial schema.
-- All access is server-side via the service-role key (Clerk owns auth, not
-- Supabase Auth). RLS is enabled as a safety net: deny everything to anon/
-- authenticated roles; service_role bypasses RLS automatically.

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────────────────
-- users — mirror of Clerk users (populated by Clerk webhook)
-- ──────────────────────────────────────────────────────────────────────────
create table users (
    id           text primary key,           -- Clerk user_id, e.g. "user_2abc..."
    email        text,
    plan         text not null default 'free' check (plan in ('free', 'premium')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index users_email_idx on users(email);

-- ──────────────────────────────────────────────────────────────────────────
-- sessions — one row per LiveKit call
-- ──────────────────────────────────────────────────────────────────────────
create table sessions (
    id           uuid primary key default gen_random_uuid(),
    user_id      text not null references users(id) on delete cascade,
    room_name    text not null,
    started_at   timestamptz not null default now(),
    ended_at     timestamptz,
    duration_s   integer
);

create index sessions_user_started_idx on sessions(user_id, started_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- transcripts — append-only log of user/assistant turns within a session
-- ──────────────────────────────────────────────────────────────────────────
create table transcripts (
    id           bigserial primary key,
    session_id   uuid not null references sessions(id) on delete cascade,
    role         text not null check (role in ('user', 'assistant')),
    text         text not null,
    ts           timestamptz not null default now()
);

create index transcripts_session_ts_idx on transcripts(session_id, ts);

-- ──────────────────────────────────────────────────────────────────────────
-- usage_minutes — daily usage rollup; one row per (user, UTC date)
-- Powers the rate limiter at /token.
-- ──────────────────────────────────────────────────────────────────────────
create table usage_minutes (
    user_id              text not null references users(id) on delete cascade,
    date                 date not null,
    seconds_used         integer not null default 0,
    trial_credit_used_s  integer not null default 0,
    primary key (user_id, date)
);

-- ──────────────────────────────────────────────────────────────────────────
-- subscriptions — Stripe state mirror (one row per premium user)
-- ──────────────────────────────────────────────────────────────────────────
create table subscriptions (
    user_id               text primary key references users(id) on delete cascade,
    stripe_customer_id    text unique,
    stripe_subscription_id text unique,
    status                text not null,        -- active, past_due, canceled, ...
    current_period_end    timestamptz,
    updated_at            timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — deny-all to anon + authenticated; server uses service_role and
-- bypasses RLS. If we ever expose tables to the client directly, add
-- explicit policies then.
-- ──────────────────────────────────────────────────────────────────────────
alter table users          enable row level security;
alter table sessions       enable row level security;
alter table transcripts    enable row level security;
alter table usage_minutes  enable row level security;
alter table subscriptions  enable row level security;
