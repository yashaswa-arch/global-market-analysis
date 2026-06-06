# Architecture

## Overview

This is a simple three-folder college project. There is no Docker, Redis, Celery, or Kubernetes — just a FastAPI server with an in-process scheduler and Groq AI modules.

```
RSS Feeds (Reuters, BBC, AP, CNBC)
        │
        ▼  every 15 min
┌───────────────────┐
│  FastAPI Backend  │──────▶ Supabase PostgreSQL
│  + APScheduler    │         ├── events
└────────┬──────────┘         ├── analysis
         │                    ├── chat_history
         │ import             └── saved_events
         ▼
┌───────────────────┐
│   ai-services/    │  Groq LLM calls
│   (Python modules)│
└───────────────────┘
         ▲
         │ HTTP (future)
┌────────┴──────────┐
│  React Frontend   │
└───────────────────┘
```

## Data Flow

1. **Scheduler** runs every 15 minutes
2. **NewsService** fetches Reuters, BBC, AP, CNBC RSS feeds
3. New articles are inserted into the **`events`** table (deduplicated by URL)
4. **AnalysisService** picks unanalyzed events and calls **ai-services** modules
5. Groq generates summary, sentiment, importance score, and key points
6. Results are stored in the **`analysis`** table
7. **Frontend** reads events and analysis via the backend API

---

## backend/

The backend is a single FastAPI application. All logic lives here except Groq prompts.

```
backend/
├── app/
│   ├── main.py                 # App entry point, CORS, route registration, scheduler startup
│   │
│   ├── routes/                 # HTTP endpoints (thin handlers)
│   │   ├── auth.py             # Auth status, saved events (save/unsave/list)
│   │   ├── events.py           # List/get events, manual RSS trigger
│   │   ├── analysis.py         # List/get analysis, manual analysis trigger
│   │   └── chat.py             # Chat message and history
│   │
│   ├── services/               # Business logic
│   │   ├── news_service.py     # RSS fetching → events table
│   │   ├── analysis_service.py # Groq pipelines → analysis table
│   │   ├── chat_service.py     # Chat with event context → chat_history table
│   │   └── scheduler.py        # APScheduler — 15-min news + analysis jobs
│   │
│   ├── database/
│   │   └── supabase_client.py  # Supabase client singleton
│   │
│   ├── models/
│   │   └── schemas.py          # Pydantic models for API request/response
│   │
│   └── config/
│       └── settings.py         # Reads from root .env
│
└── requirements.txt
```

### Route responsibilities

| File | Endpoints | Purpose |
|------|-----------|---------|
| `auth.py` | `/auth/*` | JWT validation, saved events CRUD |
| `events.py` | `/events/*` | Live news feed from `events` table |
| `analysis.py` | `/analysis/*` | AI enrichment results |
| `chat.py` | `/chat/*` | AI assistant conversations |

### Service responsibilities

| File | Purpose |
|------|---------|
| `news_service.py` | Parses RSS feeds, deduplicates by URL, inserts into `events` |
| `analysis_service.py` | Calls ai-services modules, writes to `analysis` |
| `chat_service.py` | Stores messages, calls chatbot module with event context |
| `scheduler.py` | Runs news fetch + analysis every 15 minutes using APScheduler |

---

## ai-services/

Standalone Python modules for Groq AI. Imported directly by the backend — no separate server process.

```
ai-services/
├── groq_client.py          # Shared Groq SDK wrapper
├── summarizer/
│   └── summarizer.py       # Summary + key points
├── classifier/
│   └── classifier.py       # Event category classification
├── sentiment/
│   └── sentiment.py        # Sentiment label and score
├── importance/
│   └── importance.py       # Importance score (0–100)
├── chatbot/
│   └── chatbot.py          # Conversational AI assistant
└── requirements.txt
```

### Module responsibilities

| Module | Groq Output | Stored In |
|--------|-------------|-----------|
| `summarizer` | Summary, key points | `analysis.summary`, `analysis.key_points` |
| `classifier` | Category label | `analysis.category` |
| `sentiment` | Sentiment label | `analysis.sentiment` |
| `importance` | Score 0–100 | `analysis.importance_score` |
| `chatbot` | Reply text | `chat_history.message` |

---

## frontend/

React foundation only — no pages or UI components built yet.

```
frontend/
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Placeholder shell
│   ├── api/                # Axios client + API functions
│   ├── lib/supabase.ts     # Supabase auth client
│   ├── types/              # TypeScript interfaces
│   ├── hooks/              # React Query hooks (ready for UI)
│   ├── stores/             # Zustand auth state
│   ├── pages/              # (empty — future pages)
│   └── components/         # (empty — future components)
├── index.html
├── vite.config.ts
└── package.json
```

---

## docs/

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | This document |
| `DATABASE.md` | Supabase table reference |

---

## Design Principles

1. **Single backend process** — API + scheduler in one server, no workers or message queues
2. **Direct imports** — backend imports ai-services modules, no HTTP between services
3. **Supabase as sole database** — no SQLAlchemy, no local PostgreSQL
4. **Root `.env`** — one config file shared by backend, ai-services, and frontend
5. **College-appropriate scope** — easy to understand, demo, and maintain
