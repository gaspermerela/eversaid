# Architecture

## Overview

Eversaid is a monorepo containing:

- **frontend/** - Next.js 15 with App Router
- **backend/** - FastAPI wrapper backend
- **docs/** - Documentation

## System Design

```
Frontend (Next.js on Vercel)
         │
         ▼
Wrapper Backend (FastAPI on Railway)
         │
         ▼
Core API Backend (asr-llm-core, private)
```

## Key Components

### Frontend

**Framework & Styling:**
- Next.js 15 with App Router
- Tailwind CSS v4
- shadcn/ui components (Vega/Nova style)
- Lucide React icons

**Structure:**
```
frontend/src/
├── app/                    # Next.js routes
│   ├── page.tsx           # Landing page
│   ├── demo/page.tsx      # Demo page
│   └── api-docs/page.tsx  # API documentation
├── components/            # V0-generated, presentation only
│   ├── demo/             # Demo page components
│   ├── waitlist/         # Waitlist flow components
│   └── ui/               # shadcn/ui base components
├── hooks/                # Custom React hooks
│   ├── useTranscription.ts
│   ├── useAudioPlayer.ts
│   ├── useFeedback.ts
│   ├── useDiff.ts
│   └── useSyncScroll.ts
└── lib/                  # Utilities
```

**Testing Infrastructure:**
- **Unit tests:** Vitest + React Testing Library
- **Component dev:** Storybook 8
- **E2E tests:** Playwright (Chromium)
- **CI:** GitHub Actions on PR

### Wrapper Backend
- FastAPI with SQLite
- Session management (anonymous users via cookies)
- Rate limiting (configurable per-session, per-IP, global)
- Proxies requests to Core API with Bearer auth
- Feedback and waitlist collection

**Structure:**
```
backend/
├── app/
│   ├── main.py           # FastAPI app, lifespan, error handlers
│   ├── config.py         # Pydantic Settings (rate limits, session duration)
│   ├── database.py       # SQLAlchemy engine + session
│   ├── models.py         # Session, Waitlist, Feedback, RateLimitEntry
│   ├── core_client.py    # CoreAPIClient for HTTP requests
│   ├── session.py        # Anonymous session management
│   ├── rate_limit.py     # Rate limiting (4-tier: session/hour, session/day, IP/day, global/day)
│   └── routes/
│       └── core.py       # Core API proxy endpoints
├── tests/
│   ├── conftest.py       # Test fixtures (respx mocking)
│   ├── test_session.py   # Session management tests
│   ├── test_endpoints.py # Endpoint tests
│   └── test_rate_limit.py # Rate limiting tests
├── requirements.txt      # Production dependencies
└── requirements-dev.txt  # Test dependencies (pytest, respx)
```

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/transcribe` | POST | Upload audio, start transcription |
| `/api/transcriptions/{id}` | GET | Poll transcription status |
| `/api/entries` | GET | List entries (paginated) |
| `/api/entries/{id}` | GET | Get entry details |
| `/api/entries/{id}` | DELETE | Delete entry |
| `/api/entries/{id}/audio` | GET | Stream audio file |
| `/api/cleaned-entries/{id}` | GET | Get cleanup details |
| `/api/cleaned-entries/{id}/user-edit` | PUT | Save user edit |
| `/api/cleaned-entries/{id}/user-edit` | DELETE | Revert to AI text |
| `/api/cleaned-entries/{id}/analyze` | POST | Trigger analysis |
| `/api/analyses/{id}` | GET | Get analysis result |
| `/api/analysis-profiles` | GET | List analysis profiles |

### Core API (External)
- Transcription (ElevenLabs Scribe v1)
- LLM cleanup (Groq)
- Speaker diarization
- AI analysis

## Data Flow

1. User uploads audio or records voice
2. Frontend sends to wrapper backend
3. Wrapper creates anonymous user in Core API
4. Core API processes transcription
5. Results displayed with side-by-side comparison

## Testing & CI

### Frontend
| Layer     | Tool         | Command            | Runs in CI |
| --------- | ------------ | ------------------ | ---------- |
| Lint      | ESLint       | `npm run lint`     | Yes        |
| Unit      | Vitest + RTL | `npm run test:run` | Yes        |
| Component | Storybook    | `npm run storybook`| Yes (build)|
| E2E       | Playwright   | `npm run test:e2e` | Yes        |

### Backend
| Layer     | Tool         | Command                  | Runs in CI |
| --------- | ------------ | ------------------------ | ---------- |
| Unit      | pytest+respx | `pytest tests/ -v`       | Yes        |

CI runs on every PR via GitHub Actions (`.github/workflows/pr-tests.yml`).
