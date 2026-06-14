-- =============================================================================
-- Migration 005: Row Level Security (RLS) Policies
-- Fixes: V-04 (No Row Level Security)
-- =============================================================================
--
-- HOW TO RUN:
--   1. Open your Supabase project at https://app.supabase.com
--   2. Go to: SQL Editor (left sidebar)
--   3. Click "New query"
--   4. Paste this entire file and click "Run"
--
-- WHAT THIS DOES:
--   - Enables RLS on chat_history and saved_events tables
--   - Users can only SELECT/INSERT/DELETE their own rows
--   - The backend service-role key bypasses RLS by design (server-side writes)
--   - Direct anon-key access (e.g. from frontend Supabase client) is now restricted
--
-- VERIFY AFTER RUNNING:
--   In Supabase → Table Editor → chat_history → RLS should show "Enabled"
--   In Supabase → Table Editor → saved_events → RLS should show "Enabled"
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- chat_history: users see and write only their own rows
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Allow users to read only their own chat history
CREATE POLICY "chat_history_select_own"
  ON chat_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert only rows attributed to themselves
CREATE POLICY "chat_history_insert_own"
  ON chat_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete only their own chat history rows
CREATE POLICY "chat_history_delete_own"
  ON chat_history
  FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- saved_events: users manage only their own saves
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

-- Allow users to read only their own saved events
CREATE POLICY "saved_events_select_own"
  ON saved_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to save events only under their own user_id
CREATE POLICY "saved_events_insert_own"
  ON saved_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to un-save only their own saved events
CREATE POLICY "saved_events_delete_own"
  ON saved_events
  FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- events & analysis: public read-only (intelligence feed)
-- Uncomment the block below if you want to enforce RLS on public tables too.
-- Leave commented if the feed should remain fully public.
-- ─────────────────────────────────────────────────────────────────────────────

-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "events_public_read"
--   ON events
--   FOR SELECT
--   USING (true);

-- ALTER TABLE analysis ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "analysis_public_read"
--   ON analysis
--   FOR SELECT
--   USING (true);


-- =============================================================================
-- Verification queries (run separately to confirm policies were applied)
-- =============================================================================
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('chat_history', 'saved_events');
--
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('chat_history', 'saved_events')
-- ORDER BY tablename, policyname;
-- =============================================================================
