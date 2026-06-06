-- Migration 004: Market impact intelligence on analysis table
-- Adds structured asset-level outlook data (commodities, indices, sectors).
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS throughout).

ALTER TABLE analysis
    ADD COLUMN IF NOT EXISTS market_impacts JSONB DEFAULT '[]'::jsonb;

UPDATE analysis
SET market_impacts = '[]'::jsonb
WHERE market_impacts IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'analysis_market_impacts_is_array'
    ) THEN
        ALTER TABLE analysis
            ADD CONSTRAINT analysis_market_impacts_is_array
            CHECK (jsonb_typeof(market_impacts) = 'array');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analysis_market_impacts
    ON analysis USING GIN (market_impacts);

COMMENT ON COLUMN analysis.market_impacts IS
    'JSON array of asset outlook objects: asset, outlook, confidence, reason';
