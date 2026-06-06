# Database Reference

The database exists in Supabase with four tables. The backend reads and writes via the Supabase Python client.

## Tables

### `events`

Stores raw news articles fetched from RSS feeds. **No AI fields** — ingestion stays separate from analysis.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `title` | TEXT | Article headline |
| `description` | TEXT | Article summary/content from RSS |
| `url` | TEXT | Unique article URL (`events_url_unique` constraint) |
| `source` | TEXT | Feed source: Reuters, BBC, AP, CNBC |
| `published_at` | TIMESTAMPTZ | Original publish date |
| `created_at` | TIMESTAMPTZ | When inserted into database |

### `analysis`

Stores Groq AI enrichment for each event (1:1 with `events`).

**Actual columns today:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `event_id` | UUID | Foreign key → `events.id` |
| `summary` | TEXT | AI-generated event summary |
| `sentiment` | TEXT | General tone |
| `importance_score` | REAL | Global significance 0–100 |
| `key_points` | JSONB | Array of bullet points |
| `generated_at` | TIMESTAMPTZ | When analysis was generated |

**Added by migration 002:**

| Column | Type | Description |
|--------|------|-------------|
| `category` | TEXT | Event category (politics, economy, conflict, …) |
| `impact_on_india` | TEXT | How the event affects India |
| `impact_type` | TEXT | `positive` \| `negative` \| `neutral` |
| `affected_sectors` | JSONB | e.g. `["Banking", "IT", "Energy"]` |
| `risk_level` | TEXT | `low` \| `medium` \| `high` \| `critical` |
| `confidence_score` | REAL | AI confidence 0–100 |

**Added by migration 004:**

| Column | Type | Description |
|--------|------|-------------|
| `market_impacts` | JSONB | Array of `{ asset, outlook, confidence, reason }` objects |

> **Note:** There is no `created_at` on `analysis` — use `generated_at`.

### `chat_history`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key → `auth.users.id` |
| `role` | TEXT | user or assistant |
| `message` | TEXT | Message content |
| `created_at` | TIMESTAMPTZ | Timestamp |

### `saved_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key → `auth.users.id` |
| `event_id` | UUID | Foreign key → `events.id` |
| `saved_at` | TIMESTAMPTZ | When event was saved |

## Relationships

```
events (1) ──── (0..1) analysis
events (1) ──── (0..N) saved_events
auth.users (1) ── (0..N) chat_history
auth.users (1) ── (0..N) saved_events
```

## Migrations

| File | Purpose |
|------|---------|
| *(existing Supabase schema)* | Base tables |
| [`002_analysis_impact_columns.sql`](./migrations/002_analysis_impact_columns.sql) | Adds `category` + impact columns |
| [`003_events_url_unique.sql`](./migrations/003_events_url_unique.sql) | Removes duplicate URLs + unique constraint |
| [`004_market_impacts.sql`](./migrations/004_market_impacts.sql) | Adds `market_impacts` JSONB column |

## Notes

- Run migration `002` before Groq integration.
- RSS writes only to `events`; Groq writes only to `analysis`.
- See [IMPACT_ANALYSIS.md](./IMPACT_ANALYSIS.md) for full data flow.
