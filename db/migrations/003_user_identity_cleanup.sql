-- 003 — user identity: email/name columns + phantom-row cleanup
-- Run in the Supabase SQL editor. Idempotent-ish (cleanup deletes are safe
-- to re-run; they just match nothing the second time).

-- Who is this user? (populated JIT from Clerk on first request)
alter table users
  add column if not exists email text,
  add column if not exists name text;

-- Cleanup: phantom "users" created from LiveKit participant SIDs (PA_...).
-- Root cause: Pipecat 1.5 passes participant SID (not identity) to
-- on_participant_connected, so the agent attributed sessions/usage to
-- SIDs. Fixed in code by using the dispatched user_id instead.
delete from transcripts
  where session_id in (select id from sessions where user_id like 'PA\_%');
delete from usage_minutes where user_id like 'PA\_%';
delete from phrases where user_id like 'PA\_%';
delete from subscriptions where user_id like 'PA\_%';
delete from sessions where user_id like 'PA\_%';
delete from users where id like 'PA\_%';
