-- Migration 002: Extend analysis table for impact intelligence
-- Actual baseline columns: id, event_id, summary, sentiment, importance_score,
--                          key_points, generated_at
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS throughout).

-- ---------------------------------------------------------------------------
-- 1. Add missing columns (category + impact fields)
-- ---------------------------------------------------------------------------
ALTER TABLE analysis
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS impact_on_india TEXT,
    ADD COLUMN IF NOT EXISTS impact_type TEXT,
    ADD COLUMN IF NOT EXISTS affected_sectors JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS risk_level TEXT,
    ADD COLUMN IF NOT EXISTS confidence_score REAL;

-- Ensure JSONB default for rows created before affected_sectors existed
UPDATE analysis
SET affected_sectors = '[]'::jsonb
WHERE affected_sectors IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Check constraints (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'analysis_impact_type_check'
    ) THEN
        ALTER TABLE analysis
            ADD CONSTRAINT analysis_impact_type_check
            CHECK (impact_type IS NULL OR impact_type IN ('positive', 'negative', 'neutral'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'analysis_risk_level_check'
    ) THEN
        ALTER TABLE analysis
            ADD CONSTRAINT analysis_risk_level_check
            CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high', 'critical'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'analysis_confidence_score_check'
    ) THEN
        ALTER TABLE analysis
            ADD CONSTRAINT analysis_confidence_score_check
            CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Indexes (only on columns added by this migration)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis(category);
CREATE INDEX IF NOT EXISTS idx_analysis_impact_type ON analysis(impact_type);
CREATE INDEX IF NOT EXISTS idx_analysis_risk_level ON analysis(risk_level);
CREATE INDEX IF NOT EXISTS idx_analysis_affected_sectors ON analysis USING GIN (affected_sectors);

-- ---------------------------------------------------------------------------
-- 4. Column comments
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN analysis.category IS 'Event category e.g. politics, economy, conflict';
COMMENT ON COLUMN analysis.impact_on_india IS 'AI narrative: how the global event affects India';
COMMENT ON COLUMN analysis.impact_type IS 'Directional impact: positive, negative, or neutral';
COMMENT ON COLUMN analysis.affected_sectors IS 'JSON array of Indian market sectors e.g. ["Banking","IT"]';
COMMENT ON COLUMN analysis.risk_level IS 'Risk severity: low, medium, high, critical';
COMMENT ON COLUMN analysis.confidence_score IS 'AI confidence 0-100';

-- Existing columns preserved unchanged:
--   summary, sentiment, importance_score, key_points, generated_at
