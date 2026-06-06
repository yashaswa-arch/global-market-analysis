# Impact Analysis Architecture

Architecture review and preparation for AI-powered global event impact analysis (India + market focus).  
**Status:** Foundation complete. RSS, Groq, and frontend not yet implemented.

---

## 1. Current schema analysis

### `events` — raw news (keep as-is)

| Column | Purpose | Change needed? |
|--------|---------|----------------|
| `id` | Primary key | No |
| `title` | RSS headline | No |
| `description` | RSS body/summary | No |
| `url` | Dedup key | No |
| `source` | Reuters, BBC, AP, CNBC | No |
| `published_at` | Original publish time | No |
| `created_at` | Insert timestamp | No |

**Role:** Store only raw ingested news. No AI fields here — keeps ingestion simple.

**Optional addition:** `is_analyzed BOOLEAN` — speeds up “find unprocessed events” queries. Can also be derived with `LEFT JOIN analysis WHERE analysis.id IS NULL`.

---

### `analysis` — AI enrichment (extend)

| Column | Status | Maps to requirement |
|--------|--------|---------------------|
| `summary` | **Exists** | Event Summary |
| `category` | **Add (002)** | Event Category |
| `sentiment` | **Exists** | General tone |
| `importance_score` | **Exists** | Global significance 0–100 |
| `key_points` | **Exists** | Bullet highlights |
| `generated_at` | **Exists** | Timestamp (not `created_at`) |
| `impact_on_india` | **Add** | Impact on India (text) |
| `impact_type` | **Add** | Positive / Negative / Neutral |
| `affected_sectors` | **Add** | Affected Sectors (JSON array) |
| `risk_level` | **Add** | Risk Level |
| `confidence_score` | **Add** | Confidence Score 0–100 |

**Recommendation:** Add 5 columns to `analysis` only. Do **not** create new tables for sectors, NSE, or BSE at this stage.

---

### `chat_history` / `saved_events` — no changes

Used later for assistant and bookmarks. Unrelated to impact pipeline.

---

## 2. Minimal schema changes

See migration: [`migrations/002_analysis_impact_columns.sql`](./migrations/002_analysis_impact_columns.sql)

```sql
ALTER TABLE analysis
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS impact_on_india TEXT,
    ADD COLUMN IF NOT EXISTS impact_type TEXT,
    ADD COLUMN IF NOT EXISTS affected_sectors JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS risk_level TEXT,
    ADD COLUMN IF NOT EXISTS confidence_score REAL;
```

---

## 3. Complete data flow

```
RSS Sources (Reuters, BBC, AP, CNBC)
        │
        ▼  every 15 min (planned)
Backend: news_service → parse, dedupe, insert
        │
        ▼
Supabase: events  (raw news only)
        │
        ▼  is_analyzed = false
Backend: analysis_service → call Groq
        │
        ▼
ai-services/ (planned)
  summarizer  → summary, key_points
  classifier  → category
  impact      → impact_on_india, impact_type, sectors, risk, confidence
        │
        ▼
Supabase: analysis  (all AI fields)
        │
        ▼  GET /api/events + /api/analysis
Frontend Dashboard (planned)
```

---

## 4. How Groq will generate each dimension (later)

| Output | Module | Stored in |
|--------|--------|-----------|
| Global summary | `summarizer/` | `summary`, `key_points` |
| Event category | `classifier/` | `category` |
| Impact on India | `impact/` | `impact_on_india` |
| Affected sectors | `impact/` | `affected_sectors` |
| Risk level | `impact/` | `risk_level` |
| Confidence score | `impact/` | `confidence_score` |
| Positive/Negative/Neutral | `impact/` | `impact_type` |
| Global importance | `importance/` | `importance_score` |
| NSE/BSE narrative | `impact/` | `impact_on_india` or `key_points` |

**Recommended:** One Groq JSON response per event, mapped directly to columns.

---

## 5. NSE / BSE / sector sufficiency

| Use case | Sufficient? |
|----------|-------------|
| Sector dashboard | **Yes** — `affected_sectors` JSONB |
| India impact feed | **Yes** — `impact_type`, `risk_level` |
| Qualitative NSE/BSE notes | **Yes** — text in `impact_on_india` |
| Live stock/index prices | **No** — needs market data APIs |

**Verdict:** Sufficient for a college intelligence dashboard with AI-generated qualitative market insights. Not a live trading platform.

---

## 6. Next steps

1. Run `002_analysis_impact_columns.sql` in Supabase
2. Implement RSS → `events`
3. Implement Groq → `analysis`
4. API joins event + analysis
5. Frontend dashboard
