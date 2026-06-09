-- Migration to support Event Clustering and Deep Analysis

-- 1. Create event_sources table to support multiple articles per event
CREATE TABLE IF NOT EXISTS event_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
    url TEXT UNIQUE NOT NULL,
    source TEXT,
    title TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to increment source_count when a new event_source is added
CREATE OR REPLACE FUNCTION increment_event_source_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE events
    SET source_count = source_count + 1
    WHERE id = NEW.event_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_event_source_count ON event_sources;
CREATE TRIGGER trg_increment_event_source_count
AFTER INSERT ON event_sources
FOR EACH ROW
EXECUTE FUNCTION increment_event_source_count();

-- 2. Migrate existing single-source events into event_sources
INSERT INTO event_sources (event_id, url, source, title, published_at)
SELECT id, url, source, title, published_at 
FROM events 
WHERE url IS NOT NULL AND url != ''
ON CONFLICT (url) DO NOTHING;

-- 3. Add relevance and cluster fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS relevance_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;

-- 4. Add deep analysis fields to analysis table
ALTER TABLE analysis
ADD COLUMN IF NOT EXISTS why_this_matters TEXT,
ADD COLUMN IF NOT EXISTS strategic_significance TEXT,
ADD COLUMN IF NOT EXISTS bull_case TEXT,
ADD COLUMN IF NOT EXISTS bear_case TEXT,
ADD COLUMN IF NOT EXISTS consensus_view TEXT,
ADD COLUMN IF NOT EXISTS historical_comparisons TEXT,
ADD COLUMN IF NOT EXISTS future_scenarios TEXT,
ADD COLUMN IF NOT EXISTS countries_impacted JSONB DEFAULT '[]'::jsonb;
