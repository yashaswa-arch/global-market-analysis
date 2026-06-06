-- Migration 003: Deduplicate events by URL and enforce uniqueness
-- Run in Supabase SQL Editor. Safe to re-run where noted.

-- ---------------------------------------------------------------------------
-- 1. Identify duplicate event ids to remove (keep oldest per url)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _events_to_delete;
CREATE TEMP TABLE _events_to_delete AS
SELECT id
FROM (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY url
               ORDER BY created_at ASC NULLS LAST, id ASC
           ) AS row_num
    FROM events
    WHERE url IS NOT NULL AND url <> ''
) ranked
WHERE row_num > 1;

-- ---------------------------------------------------------------------------
-- 2. Remove dependent rows for duplicates (if tables exist)
-- ---------------------------------------------------------------------------
DELETE FROM analysis
WHERE event_id IN (SELECT id FROM _events_to_delete);

DELETE FROM saved_events
WHERE event_id IN (SELECT id FROM _events_to_delete);

DELETE FROM events
WHERE id IN (SELECT id FROM _events_to_delete);

DROP TABLE IF EXISTS _events_to_delete;

-- ---------------------------------------------------------------------------
-- 3. Unique constraint on url (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'events_url_unique'
    ) THEN
        ALTER TABLE events
            ADD CONSTRAINT events_url_unique UNIQUE (url);
    END IF;
END $$;

COMMENT ON CONSTRAINT events_url_unique ON events IS 'Prevents duplicate news articles by URL';
