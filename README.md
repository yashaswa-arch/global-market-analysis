# Global Event Intelligence Platform

A college project that collects global news from RSS feeds and GNews API, stores events in Supabase, enriches them with Groq AI for India-focused impact analysis, and serves them through a FastAPI backend and React frontend (planned).

## Project Structure

```
global/
├── frontend/       # React app (not yet implemented)
├── backend/        # FastAPI REST API + news scheduler
├── ai-services/    # Groq client + analyzer engine
├── docs/           # Architecture and database documentation
├── .env            # Shared environment variables (project root)
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, TypeScript (planned) |
| Backend | FastAPI, APScheduler |
| Database | Supabase PostgreSQL |
| News | RSS (BBC, Reuters, AP, CNBC) + GNews API |
| AI | Groq (`llama-3.3-70b-versatile`) |

---

## Current status

| Component | Status |
|-----------|--------|
| FastAPI backend | Working |
| Supabase connection | Connected |
| News collection (RSS + GNews) | **Implemented** |
| Scheduler (15 min) | **Implemented** |
| Groq AI analysis | **Implemented** |
| AI chat API | **Implemented** |
| Market impact intelligence | **Implemented** |
| Frontend dashboard | Not implemented |

---

## End-to-end data flow

```
RSS Feeds + GNews API
        │
        ▼
news_service.py  →  normalize  →  dedupe  →  insert
        │
        ▼
Supabase: events (is_analyzed = false)
        │
        ▼
POST /api/analysis/run
        │
        ▼
relevance_filter.py  (skip celebrity/gossip/lifestyle — no Groq call)
        │
        ▼
ai-services/analyzer/engine.py  →  Groq strict JSON  →  Pydantic validation
        │
        ▼
Supabase: analysis table  +  events.is_analyzed = true
        │
        ▼
GET /api/analysis  →  Dashboard (planned)
        │
        ▼
POST /api/chat/ask  →  keyword search on analysis  →  Groq answer  →  chat_history
```

---

## AI chat architecture

### Data flow

```
User question
     │
     ▼
asset_intelligence.py  →  detect asset/sector intent  →  expand search terms
     │
     ▼
chat_retrieval.py  →  score + rank + direct evidence detection
     │
     ▼
Build context (max 5 events, max 6000 chars)
     │
     ▼
chatbot.py  →  Groq (direct evidence OR inference mode)
     │
     ▼
Answer + sources + evidence flags  →  chat_history
```

### Components

| File | Role |
|------|------|
| `backend/app/services/asset_intelligence.py` | Centralized asset map, intent detection, term expansion |
| `backend/app/services/chat_retrieval.py` | Scoring, ranking, false-positive filter, evidence detection |
| `backend/app/services/chat_service.py` | Orchestration, context build, Groq call |
| `ai-services/chatbot/chatbot.py` | Direct vs inference answer prompts |
| `backend/app/routes/chat.py` | `POST /ask` |

### Asset-aware retrieval

#### Old retrieval (problems)

| Issue | Effect |
|-------|--------|
| Raw keyword substring match | `"gold"` matched `"golden helmet"` |
| No asset map | Commodity vs archaeology not distinguished |
| Keyword-only scoring | Missed "bullion", "opec", "equity market" matches |
| No evidence mode | Chat could not tell direct vs inferred answers |

#### New retrieval

1. **Detect intent** — `asset` (Gold, Crude Oil, Nifty, …), `sector` ("which sectors benefit?"), or `general`
2. **Expand terms** — e.g. Gold → `{gold, bullion, precious metal, inflation hedge, commodity}`
3. **Score all fields** with expanded terms + asset-map boosts per field
4. **False-positive filter** — `golden helmet` excluded for Gold queries
5. **Direct evidence** — `market_impacts.asset` match OR `affected_sectors` match for sector assets
6. **Inference mode** — asset question but no direct evidence → Groq answers cautiously from related events

#### Scoring model

| Signal | Weight |
|--------|--------|
| Expanded term × field weight | title 3, category 2, summary 2, impact_on_india 6, sectors 5, market_impacts 6, key_points 2 |
| Asset map term in field | +4 per hit |
| `market_impacts.asset` match | +30 |
| `affected_sectors` match | +18 |
| False positive (e.g. golden helmet) | −50 |
| Weak asset relevance (generic geopolitical only) | −25 |
| Importance score (general queries) | +importance÷25 |
| Importance score (importance-mode queries) | **+importance÷5** |
| Risk level (importance-mode) | critical +20, high +14, medium +8 |
| Substantive `impact_on_india` (importance-mode) | +12 |
| `market_impacts` present (importance-mode) | +10 |
| Human interest / survival / entertainment (importance-mode) | **−45** |

#### Importance-aware ranking (general queries)

Questions like *"What are the most important events right now?"* trigger **importance mode**:

- Generic terms (`important`, `events`, `right`, `now`) are de-emphasized in keyword matching
- **`importance_score`** becomes the dominant signal (÷5 instead of ÷25)
- Boosts: `risk_level`, substantive `impact_on_india`, `market_impacts` presence
- Down-ranks: survival stories, Everest, rescue, celebrity, entertainment, lifestyle
- Filters out human-interest stories with `importance_score` < 55
- Sort key: `score + importance_score`

#### Diversity selection

Events are chosen with diversity-aware ranking (not plain top-N):

| Adjustment | Effect |
|------------|--------|
| New category not yet selected | +10 |
| Title overlap ≥ 45% with a selected event | −18 |
| Third+ event from same category | −8 |

Weakly relevant geopolitical events are filtered out for asset/sector questions unless they have direct evidence or asset-field matches.

#### Consensus generation

`consensus.py` aggregates `market_impacts` across selected events:

- **Supporting** vs **conflicting** events per asset
- **Overall outlook** (bullish / bearish / neutral / mixed) via confidence-weighted votes
- Prepends `CONSENSUS SUMMARY` to Groq context
- Returns structured `consensus` in the API response

Groq synthesizes multiple events — not a single source.

#### Chat API response (new fields)

```json
{
  "answer": "...",
  "sources": [...],
  "direct_evidence": true,
  "inference_mode": false,
  "detected_assets": ["Nifty"],
  "query_type": "asset",
  "events_used": 2,
  "consensus": [{
    "asset": "Nifty",
    "overall_outlook": "mixed",
    "weighted_confidence": 67.5,
    "reasoning": "2 event(s) mention Nifty: 1 bullish, 1 bearish — mixed outlook.",
    "supporting_events": [{ "title": "...", "outlook": "bullish" }],
    "conflicting_events": [{ "title": "...", "outlook": "bearish" }]
  }]
}
```

#### Debug logging

Each `/api/chat/ask` logs `Chat retrieval debug` with:

- `detected_assets`, `expanded_terms`, `query_type`
- `candidate_scores` (top 10 with breakdown)
- `selected_events`, `selected_categories`, `direct_evidence`, `inference_mode`

#### Limitations

- Still keyword/term based — not semantic search
- No live market prices
- Direct evidence requires prior analysis with `market_impacts` populated

#### Future improvements

- Embeddings + vector retrieval
- Live commodity/index feeds
- Per-asset retrieval indexes

### Context limits (token control)

| Setting | Default | Purpose |
|---------|---------|---------|
| `CHAT_MAX_CONTEXT_EVENTS` | `5` | Max events sent to Groq per question |
| `CHAT_MAX_CONTEXT_CHARS` | `6000` | Hard cap on context string length |

Search uses the **asset intelligence map** and expanded terms — not raw substring matching alone. No embeddings or vector DB.

### Modified files (asset-aware retrieval)

| Action | File |
|--------|------|
| **New** | `backend/app/services/asset_intelligence.py` |
| **New** | `backend/app/services/consensus.py` |
| **Modified** | `backend/app/services/chat_retrieval.py` |
| **Modified** | `backend/app/services/chat_service.py` |
| **Modified** | `backend/app/models/schemas.py` |
| **Modified** | `ai-services/chatbot/chatbot.py` |
| **Modified** | `README.md` |

### Chat history storage

Messages are stored in `chat_history` with `role` = `user` or `assistant`. Set `CHAT_DEFAULT_USER_ID` in `.env` to a valid Supabase auth user UUID, or pass `user_id` in the request body.

---

## Modified files (AI chat API)

| Action | File |
|--------|------|
| **New** | `backend/app/services/chat_service.py` |
| **Modified** | `backend/app/routes/chat.py` |
| **Modified** | `backend/app/models/schemas.py` |
| **Modified** | `backend/app/config/settings.py` |
| **Modified** | `ai-services/chatbot/chatbot.py` |
| **Modified** | `backend/.env.example` |
| **Modified** | `.env.example` |
| **Modified** | `README.md` |

---

## AI analysis architecture

### Components

| File | Role |
|------|------|
| `backend/app/services/relevance_filter.py` | Pre-Groq keyword filter — blocks celebrity, entertainment, gossip, lifestyle |
| `ai-services/analyzer/prompts.py` | System + user prompt templates |
| `ai-services/analyzer/schemas.py` | Pydantic validation for Groq JSON output |
| `ai-services/analyzer/engine.py` | Groq call, JSON parse, retry (3×), validation |
| `ai-services/groq_client.py` | Async Groq client with `response_format: json_object` |
| `backend/app/services/analysis_service.py` | Orchestration: fetch → filter → analyze → store → mark analyzed |
| `backend/app/routes/analysis.py` | `POST /run`, `GET /` |

### Prompt design

**System prompt** (`ai-services/analyzer/prompts.py`):

- Role: geopolitical/economic analyst focused on **India impact**
- Topic scope: geopolitics, economy, trade, energy, technology, defense, supply chains, conflicts, international relations, environment, healthcare, education, hospitality, tourism, agriculture, finance, legal, science, infrastructure
- Explicit exclusions: celebrity, entertainment, weddings, gossip, sports gossip, lifestyle
- Output: **strict JSON only** — no markdown, no extra keys
- Fields: `category`, `summary`, `sentiment`, `importance_score`, `key_points`, `impact_on_india`, `impact_type`, `affected_sectors`, `risk_level`, `confidence_score`, `market_impacts`

**User prompt** includes event title, description, source, and URL.

**Groq settings:** `temperature=0.2`, `max_tokens=2048`, `response_format={"type": "json_object"}`.

### Retry and error handling

1. **Relevance filter** — irrelevant events are marked `is_analyzed=true` without calling Groq (saves API cost).
2. **JSON parse** — if Groq returns invalid JSON, retry up to 3 times.
3. **Pydantic validation** — categories, sectors, assets, enums, and score ranges validated before DB insert; invalid responses retry. Unknown sector/asset labels are dropped instead of failing the whole analysis.
4. **Failed events** — after all retries, event stays `is_analyzed=false`; error logged and returned in run stats.
5. **Successful analysis** — insert into `analysis`, then set `events.is_analyzed=true`.

### Analysis output schema

| Field | Type | Values / range |
|-------|------|----------------|
| `category` | TEXT | See [Analysis validation](#analysis-validation) — 20 allowed categories |
| `summary` | TEXT | 2–3 sentence summary |
| `sentiment` | TEXT | positive, negative, neutral, mixed |
| `importance_score` | REAL | 0–100 |
| `key_points` | JSONB | Array of bullet strings |
| `impact_on_india` | TEXT | India-specific impact narrative |
| `impact_type` | TEXT | positive, negative, neutral |
| `affected_sectors` | JSONB | e.g. `["IT", "Energy", "Banking"]` |
| `risk_level` | TEXT | low, medium, high, critical |
| `confidence_score` | REAL | 0–100 |
| `market_impacts` | JSONB | Array of asset outlook objects (see below) |

Run migrations [`002`](./docs/migrations/002_analysis_impact_columns.sql) and [`004`](./docs/migrations/004_market_impacts.sql) before analysis with market impact.

### Analysis validation

Validation lives in `ai-services/analyzer/schemas.py`. Groq output must pass Pydantic checks before insert.

#### Category allowlist (old → new)

| Removed / unchanged | **Added in validation expansion** |
|---------------------|-----------------------------------|
| geopolitics, economy, trade, energy, technology, defense, supply_chains, conflict, international_relations, other | **environment**, **healthcare**, **education**, **hospitality**, **tourism**, **agriculture**, **finance**, **legal**, **science**, **infrastructure** |

**Total:** 10 categories → **20 categories**.

Common Groq aliases are normalized before validation (e.g. `environmental` → `environment`, `health` → `healthcare`, `travel` → `tourism`). Values outside the allowlist still fail (e.g. `celebrity`, random free text).

#### Sector and asset validation

| Field | Behavior |
|-------|----------|
| `affected_sectors` | Must be from the expanded India sector list; **unknown labels are dropped** (no whole-event failure) |
| `market_impacts[].asset` | Must map to an allowed asset/sector/index; **unmapped items are dropped** |
| `market_impacts[].outlook` | Strict: `bullish`, `bearish`, `neutral` |
| `sentiment`, `impact_type`, `risk_level` | Strict enums (unchanged) |

**Expanded sectors:** Banking, IT, Pharma, Auto, Energy, FMCG, Metals, Hospitality, Tourism, Media, Healthcare, Education, Agriculture, Telecom, Real Estate, Infrastructure, Renewables.

**Expanded market assets:** above sectors plus Gold, Silver, Crude Oil, Natural Gas, Nifty, Sensex, Nasdaq, S&P 500, USD/INR.

#### Validation failure audit (last 50 logged failures)

Source: analysis run logs from a prior batch (`failed=10` per batch, Groq daily token limit blocked a live re-audit).

| Rejected value | Field | Count in logs | Resolution |
|----------------|-------|---------------|------------|
| `Hospitality`, `Tourism` | `affected_sectors` | 6 | Added to sector allowlist |
| `environment` | `category` | 2 | Added to category allowlist |
| `Media`, `Entertainment` | `affected_sectors` | 3 | Added `Media`; alias `entertainment` → `Media` |
| `Renewable Energy` | `market_impacts.asset` | 1 | Alias → `Renewables` |
| `Carbon Credits` | `market_impacts.asset` | 2 | Alias → `Energy`; unmapped assets now dropped |
| `Chinese Tech Stocks` | `market_impacts.asset` | 2 | Alias → `IT` |
| `Nasdaq` | `market_impacts.asset` | 2 | Added to market asset allowlist |

User-reported Groq categories (`healthcare`, `education`, `hospitality`, `tourism`) were added to the category allowlist even when failures were logged against sectors instead.

Re-run analysis after deploy:

```powershell
Invoke-RestMethod -Method POST http://localhost:8000/api/analysis/run
```

---

## Market Impact Intelligence

### Schema change (minimal)

One new JSONB column on the existing `analysis` table — no new tables:

```sql
ALTER TABLE analysis ADD COLUMN market_impacts JSONB DEFAULT '[]';
```

Each element:

```json
{
  "asset": "Gold",
  "outlook": "bullish",
  "confidence": 75,
  "reason": "Geopolitical tension typically increases safe-haven demand"
}
```

### Supported assets

| Group | Assets |
|-------|--------|
| Commodities | Gold, Silver, Crude Oil, Natural Gas |
| Markets | Nifty, Sensex, USD/INR |
| Indian sectors | Banking, IT, Pharma, Auto, Energy, FMCG, Metals |

### What we generate (and what we do not)

| Generated | Not generated |
|-----------|---------------|
| Likely impact (`bullish` / `bearish` / `neutral`) | Buy recommendations |
| Confidence (0–100) | Sell recommendations |
| Short reasoning | Target prices |
| | Guaranteed predictions |

### Architecture

```
Groq analysis (single call)
  → India impact + sector impact + market_impacts[]
  → Pydantic validation (asset names, outlook, forbidden terms)
  → analysis.market_impacts JSONB

Chat question ("Will gold rise?")
  → weighted retrieval (market_impacts weight = 5)
  → asset-term boost (+15 when asset matches)
  → context includes Market impacts section
  → Groq answer using stored outlook data
```

### Retrieval improvements

| Field | Weight | Purpose |
|-------|--------|---------|
| `title` | 3 | Match headline keywords |
| `category` | 2 | Topic alignment |
| `summary` | 2 | Event content |
| `impact_on_india` | 3 | India-focused questions |
| `affected_sectors` | 2 | Sector benefit/harm questions |
| `market_impacts` | 5 | Gold, oil, Nifty, USD/INR questions |
| `key_points` | 1 | Supporting detail |

Additional **+15 boost** when a question asset term (e.g. `Gold`) matches a stored `market_impacts.asset`.

Only **top-scoring events** are sent to Groq (default max 5).

### Limitations

- Outlooks are **AI-inferred from news**, not live market prices
- No real-time gold, oil, or stock API feeds
- Keyword retrieval — not semantic search
- Existing analyzed rows need **re-analysis** to populate `market_impacts`

### Future upgrades (out of scope)

- Live commodity/index price feeds
- Embeddings + vector search for retrieval
- Separate `market_impacts` table with historical tracking
- User portfolio-aware impact mapping

### Modified files (market impact layer)

| Action | File |
|--------|------|
| **New** | `docs/migrations/004_market_impacts.sql` |
| **Modified** | `ai-services/analyzer/schemas.py` |
| **Modified** | `ai-services/analyzer/prompts.py` |
| **Modified** | `ai-services/analyzer/engine.py` |
| **Modified** | `backend/app/services/analysis_service.py` |
| **Modified** | `backend/app/services/chat_service.py` |
| **Modified** | `ai-services/chatbot/chatbot.py` |
| **Modified** | `docs/DATABASE.md` |
| **Modified** | `README.md` |

---

## Modified files (AI analysis engine)

| Action | File |
|--------|------|
| **New** | `backend/app/services/relevance_filter.py` |
| **New** | `backend/app/services/analysis_service.py` |
| **New** | `ai-services/analyzer/__init__.py` |
| **New** | `ai-services/analyzer/engine.py` |
| **New** | `ai-services/analyzer/prompts.py` |
| **New** | `ai-services/analyzer/schemas.py` |
| **Modified** | `backend/app/routes/analysis.py` |
| **Modified** | `backend/app/models/schemas.py` |
| **Modified** | `backend/app/config/settings.py` |
| **Modified** | `backend/requirements.txt` |
| **Modified** | `ai-services/groq_client.py` |
| **Modified** | `backend/.env.example` |
| **Modified** | `README.md` |

---

## News collection architecture

```
RSS Feeds (BBC, Reuters, AP, CNBC)
        +
GNews API
        │
        ▼
┌───────────────────────┐
│  news_service.py      │
│  • fetch RSS          │
│  • fetch GNews        │
│  • normalize          │
│  • dedupe (url/title) │
│  • insert             │
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│  Supabase: events     │
│  is_analyzed = false  │
└───────────┬───────────┘
            ▼
     analysis_service → analysis table → GET /api/analysis
```

### Normalized event format

All sources are converted to:

```json
{
  "title": "...",
  "description": "...",
  "source": "BBC World News",
  "url": "https://...",
  "published_at": "2026-06-06T12:00:00Z"
}
```

### Deduplication

1. **Primary:** normalized `url` (stripped, trailing `/` removed)
2. **Fallback:** normalized `title` (lowercase, punctuation stripped)
3. **In-batch:** duplicates within one fetch are skipped
4. **Database:** `UNIQUE` constraint on `events.url` — see [`003_events_url_unique.sql`](./docs/migrations/003_events_url_unique.sql)

### RSS sources (verified)

| Source | Feed URL | Status |
|--------|----------|--------|
| BBC World News | `http://feeds.bbci.co.uk/news/world/rss.xml` | Official BBC RSS |
| Reuters World News | Google News `site:reuters.com+world` syndication | Replaces retired `feeds.reuters.com` |
| AP News | Google News `site:apnews.com` syndication | Replaces blocked RSSHub / AP direct feeds |
| CNBC News | CNBC official RSS search endpoint | Official CNBC RSS |

**Why URLs changed (June 2026):**

| Old URL | Failure | Replacement |
|---------|---------|-------------|
| `https://feeds.reuters.com/reuters/worldNews` | DNS failure — Reuters discontinued public RSS at this domain | Google News Reuters world syndication |
| `https://rsshub.app/apnews/topics/apf-topnews` | HTTP 403 — RSSHub restricts free feed-reader access | Google News AP syndication |

BBC and CNBC official feeds were kept unchanged (both return valid XML).

**Verify feeds locally:**

```bash
cd backend
python scripts/test_rss_feeds.py
```

Expected: `4/4 feeds OK`

---

## Setup

### 1. Prerequisites

- Python 3.11+
- Supabase project with `events` table (including `is_analyzed` column)
- GNews API key from [gnews.io](https://gnews.io)

### 2. Environment variables

Copy `backend/.env.example` to `global/.env` or `backend/.env`.

#### Required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase API key |

#### News collection

| Variable | Default | Description |
|----------|---------|-------------|
| `GNEWS_API_KEY` | — | GNews API key (skip GNews if empty) |
| `NEWS_FETCH_INTERVAL_MINUTES` | `15` | Scheduler interval |
| `NEWS_FETCH_ENABLED` | `true` | Enable/disable scheduler |
| `GNEWS_MAX_ARTICLES` | `20` | Max GNews articles per fetch |
| `RSS_MAX_ARTICLES_PER_FEED` | `25` | Max RSS articles per feed |

#### Groq AI analysis

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | **Required** for analysis |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model name |
| `ANALYSIS_BATCH_SIZE` | `5` | Max events per `POST /api/analysis/run` |

#### AI chat

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAT_MAX_CONTEXT_EVENTS` | `5` | Max analyzed events in chat context |
| `CHAT_MAX_CONTEXT_CHARS` | `6000` | Max context characters per question |
| `CHAT_DEFAULT_USER_ID` | — | Supabase auth user UUID for `chat_history` storage |

#### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `true` | Enables `/docs` |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed origins |
| `API_PREFIX` | `/api` | API route prefix |

### 3. Install and run

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 4. Trigger first fetch

```powershell
Invoke-RestMethod -Method POST http://localhost:8000/api/events/fetch
```

### 5. Run AI analysis

```powershell
Invoke-RestMethod -Method POST http://localhost:8000/api/analysis/run
```

Optional batch size: `POST /api/analysis/run?batch_size=10`

### 6. Ask the AI chat

```powershell
$body = @{ question = "How does the Iran conflict affect India?" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/chat/ask -Body $body -ContentType "application/json"
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | App health (no DB) |
| GET | `/test-db` | Supabase connection test |
| **POST** | **`/api/events/fetch`** | **Manually trigger RSS + GNews collection** |
| **GET** | **`/api/events`** | **Latest events (paginated)** |
| **GET** | **`/api/events/unanalyzed`** | **Events with `is_analyzed = false`** |
| **POST** | **`/api/analysis/run`** | **Analyze unanalyzed events via Groq** |
| **GET** | **`/api/analysis`** | **List analyzed events with India impact fields** |
| **POST** | **`/api/chat/ask`** | **Ask questions using analyzed events as context** |
| GET | `/docs` | Swagger UI |

### Analysis route registration

Routes are mounted in three layers:

```
backend/app/routes/analysis.py   →  POST /run , GET /
backend/app/routes/router.py     →  prefix /analysis
backend/app/main.py              →  prefix /api  (from API_PREFIX)
```

Final URLs:

| Method | Full path |
|--------|-----------|
| POST | `/api/analysis/run` |
| GET | `/api/analysis` |

Verify in Swagger at `http://localhost:8000/docs` under the **analysis** tag. If you get **404**, restart uvicorn after pulling changes (`Ctrl+C`, then re-run). Do not omit the `/api` prefix.

### Examples

**Fetch news:**
```bash
POST /api/events/fetch
```

Response:
```json
{
  "status": "ok",
  "fetched": 45,
  "inserted": 12,
  "skipped_duplicates": 33,
  "enriched_descriptions": 5,
  "errors": [],
  "sources": { "rss": 40, "gnews": 25, "gnews_enriched": 5 }
}
```

**List events:**
```
GET /api/events?limit=20&offset=0
```

**Unanalyzed events:**
```
GET /api/events/unanalyzed?limit=10
```

**Run analysis:**
```bash
POST /api/analysis/run?batch_size=5
```

Response:
```json
{
  "status": "ok",
  "batch_size": 5,
  "processed": 5,
  "analyzed": 4,
  "filtered_irrelevant": 1,
  "failed": 0,
  "errors": []
}
```

**List analyzed events:**
```
GET /api/analysis?limit=20&offset=0
```

**Ask chat:**
```bash
POST /api/chat/ask
```

Request:
```json
{
  "question": "How does the Iran conflict affect India?"
}
```

Response:
```json
{
  "answer": "...",
  "sources": [
    {
      "event_id": "...",
      "title": "...",
      "url": "...",
      "category": "conflict",
      "summary": "..."
    }
  ],
  "direct_evidence": true,
  "inference_mode": false,
  "detected_assets": ["Gold"],
  "query_type": "asset"
}
```

---

## Scheduler flow

```
App startup (main.py lifespan)
        │
        ▼
start_scheduler()  →  APScheduler interval job
        │
        ▼  every NEWS_FETCH_INTERVAL_MINUTES (default 15)
_scheduled_news_fetch()
        │
        ▼
NewsService.collect_all()
        │
        ▼
Log inserted / skipped / errors
```

Disable with `NEWS_FETCH_ENABLED=false`.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `503 supabase_connection_error` | Missing/invalid Supabase env | Set `SUPABASE_URL` and `SUPABASE_KEY` |
| GNews skipped in logs | `GNEWS_API_KEY` not set | Add key to `.env` |
| `GNews unavailable` in errors | Invalid key or rate limit | Check GNews dashboard |
| RSS errors for one feed | Feed down or blocked | Run `python scripts/test_rss_feeds.py`; other feeds still work |
| Reuters/AP RSS empty | Old URLs retired or blocked | Use current Google News syndication URLs in `news_service.py` |
| `502 supabase_query_error` on insert | Missing `is_analyzed` column | Add column to `events` table |
| Duplicate events (same URL) | No DB unique constraint; in-memory dedup capped at 1000 rows | Run migration `003`; restart backend |
| Scheduler not running | `NEWS_FETCH_ENABLED=false` | Set to `true` and restart |
| Analysis returns `GROQ_API_KEY is not configured` | Missing Groq key | Set `GROQ_API_KEY` in `.env` |
| `404` on `/api/analysis/run` | Stale server or wrong URL | Restart uvicorn; use exact path `/api/analysis/run` (see route registration above) |
| Analysis insert fails | Migration 002 not applied | Run `002_analysis_impact_columns.sql` in Supabase |
| Event stays unanalyzed after run | Groq returned invalid JSON after 3 retries | Check logs; re-run `/api/analysis/run` |
| Chat answer is generic / empty | No analyzed events in DB | Run news fetch + analysis first |
| Chat history not stored | `CHAT_DEFAULT_USER_ID` not set | Set a valid Supabase auth user UUID in `.env` |
| Analysis insert fails on `market_impacts` | Migration 004 not applied | Run `004_market_impacts.sql` in Supabase |
| Chat lacks market outlook data | Events analyzed before migration 004 | Re-run analysis on new events or reset `is_analyzed` |

---

## Error responses

| HTTP Status | Code | When |
|-------------|------|------|
| 503 | `supabase_connection_error` | Supabase unreachable |
| 502 | `supabase_query_error` | Database read/write failed |

---

## Documentation

- [Impact Analysis](./docs/IMPACT_ANALYSIS.md) — AI schema and Groq design
- [Database](./docs/DATABASE.md) — Table reference
- [Migration 002](./docs/migrations/002_analysis_impact_columns.sql) — Analysis columns

---

## Interview questions

1. **Why filter before Groq?** Saves API cost and latency by skipping obvious non-intelligence content (celebrity, gossip) with a deterministic keyword filter.
2. **Why one Groq call per event?** Simple, debuggable, and sufficient for structured enrichment without agents or RAG.
3. **How do you ensure valid JSON?** Groq `json_object` mode + Pydantic validation + 3 retries; failed events are not marked analyzed.
4. **What happens to irrelevant events?** Marked `is_analyzed=true` without an `analysis` row so they leave the processing queue.
5. **How is India impact modeled?** Dedicated `impact_on_india`, `impact_type`, `affected_sectors`, and `risk_level` fields in the prompt and schema.
6. **Why separate `events` and `analysis` tables?** Ingestion stays fast and schema-stable; AI fields can evolve independently.
7. **How would you scale this?** Increase `ANALYSIS_BATCH_SIZE`, add a scheduled analysis job, or queue events with a worker — without changing the core pipeline.

### Chat

8. **Why keyword search instead of embeddings?** Simpler, no vector DB, sufficient for a college-scale dataset; scores overlap on titles, summaries, and `impact_on_india`.
9. **How do you limit Groq token usage?** Cap events (`CHAT_MAX_CONTEXT_EVENTS`) and total context chars (`CHAT_MAX_CONTEXT_CHARS`).
10. **What is the knowledge source?** The `analysis` table joined with `events` — not raw RSS or external search.
11. **Why return `sources`?** Lets users trace answers back to specific analyzed events (transparency and debugging).

### Market impact

12. **Why JSONB for market impacts?** Minimal schema change — one column stores structured asset outlooks without a new table.
13. **Why bullish/bearish instead of buy/sell?** Describes likely direction without giving trading advice.
14. **How does chat use market_impacts?** Weighted retrieval prioritizes events with matching assets; context includes outlook/confidence/reason before Groq generates the answer.
15. **Why not live market APIs?** Keeps the college project simple — impact is inferred from news intelligence, not tick data.

---

## Backend folder tree

```
backend/
├── .env.example
├── requirements.txt
└── app/
    ├── main.py                 # App + lifespan + scheduler
    ├── config/settings.py      # Env config
    ├── core/exceptions.py      # Custom errors
    ├── database/supabase_client.py
    ├── models/schemas.py
    ├── services/
    │   ├── news_service.py     # RSS + GNews + dedupe + store
    │   ├── analysis_service.py # Groq analysis orchestration
    │   ├── chat_service.py     # Chat Q&A over analyzed events
    │   ├── relevance_filter.py # Pre-Groq keyword filter
    │   └── scheduler.py        # 15-min APScheduler job
    └── routes/
        ├── events.py           # /fetch, /, /unanalyzed
        ├── analysis.py         # /run, /
        ├── chat.py             # /ask
        ├── database.py         # test-db helper
        └── ...
```

```
ai-services/
├── groq_client.py              # Async Groq wrapper
├── analyzer/
│   ├── engine.py               # Analyze + retry + validate
│   ├── prompts.py              # System/user prompts
│   └── schemas.py              # Pydantic output model
└── chatbot/
    └── chatbot.py              # Chat Q&A over event context
```
