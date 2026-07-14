-- 004 — academy alignment (Británico / ICPNA pivot)
-- Run in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- Idempotent: safe to run twice.

-- Where the learner studies English and which cycle they're in.
--   institute: 'britanico' | 'icpna' | 'self'  (null = not asked yet)
--   cycle:     e.g. 'basico-7', 'intermedio-3', 'avanzado-12' (null for 'self')
alter table users
  add column if not exists institute text,
  add column if not exists cycle text;
