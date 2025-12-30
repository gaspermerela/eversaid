# EverSaid - Implementation Plan

> **Product Name:** EverSaid
> **Repository Name:** eversaid (technical)

## Table of Contents

1. [Overview](#overview)
2. [Target Users](#target-users)
3. [Architecture](#architecture)
4. [Project Setup](#project-setup)
5. [Commit Guidelines](#commit-guidelines)
6. [Frontend Development Workflow](#frontend-development-workflow)
7. [CLAUDE.md Template](#claudemd-template)
8. [Repository Structure (Monorepo)](#repository-structure-monorepo)
9. [Wrapper Backend Design](#wrapper-backend-design)
10. [Demo Frontend Design](#demo-frontend-design)
11. [Demo Page - The Core Experience](#demo-page---the-core-experience)
12. [Results Display — CORE FEATURE](#results-display--core-feature)
13. [UI States](#ui-states)
14. [Core API Endpoints (for API Docs Page)](#core-api-endpoints-for-api-docs-page)
15. [Backbone (Core API) Changes Required](#backbone-core-api-changes-required)
16. [Diarization](#diarization)
17. [Deployment](#deployment)
18. [Implementation Phases](#implementation-phases)
19. [Visual Testing with Playwright MCP](#visual-testing-with-playwright-mcp)
20. [TODOs for Review](#todos-for-review)
21. [Key Files to Reference](#key-files-to-reference)

---

## Overview

**Product Name:** eversaid (lowercase in display, Comfortaa font)
**Tagline:** Smart transcription. AI listens. You decide.
**Subtitle:** AI-powered cleanup you can review, refine, and trust. See every edit. Verify against the original audio.

Demo project showcasing the backbone transcription API with:
- Transcription via ElevenLabs Scribe v1 (supports 99+ languages)
- Speaker diarization with user-specified speaker count
- LLM cleanup with side-by-side raw vs clean comparison
- AI analysis with selectable profiles (Summary, Action Items, Reflection)
- Spellcheck on cleaned text (Slovenian initially, more languages coming)
- No login required (cookie-based sessions)
- Configurable data retention (default: 7 days)
- Waitlist capture with referral system for API access and extended usage

**Core Trust Messaging (Two Dimensions):**
1. **Trust in what was said** — Verification, transparency, proof
   - Side-by-side comparison shows exactly what AI changed
   - Audio-linked segments let you verify against the source
   - Speaker labels ensure accurate attribution

2. **Trust with your data** — Privacy, security, compliance
   - GDPR compliant
   - Encrypted data (in transit and at rest)
   - Data isolation (your data is protected from others)
   - No AI training on your data

## Target Users

### Primary (Early Audience)
- **Therapists / Coaches** — Session notes, accuracy, accountability
- **Journalists / Researchers** — Interviews, speaker attribution

### Why They Pay
- Accuracy requirements
- Need to review & verify content
- Speaker-aware transcription
- Audio-linked evidence (trust)

### Demo Limits
- Max file size: 50MB
- Max duration: 5 minutes
- Rate limits: Configurable (default: 5/hour, 20/day per session)
- Session duration: Configurable (default: 7 days)

---

## Architecture

### Two-Backend Split

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js on Vercel)                               │
│  - Landing page (SSR)                                       │
│  - Demo page with side-by-side raw vs clean comparison      │
│  - Results display with diff highlighting                   │
│  - Cookie session + localStorage entries                    │
│  - Bilingual (sl/en)                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Wrapper Backend (FastAPI on Railway)                       │
│  - Session management (SQLite)                              │
│  - Rate limiting (per-session, per-IP) — CONFIGURABLE       │
│  - Feedback collection                                      │
│  - Waitlist capture                                         │
│  - No cleanup needed (data preserved for analytics)         │
│  - Proxies to Core API via anonymous user per session       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Core API Backend (asr-llm-core, private)                   │
│  - Pluggable ASR providers (default: ElevenLabs Scribe v1)  │
│  - LLM cleanup (Groq)                                       │
│  - AI analysis with profiles                                │
│  - Speaker diarization                                      │
│  - Slovenian spellcheck                                     │
└─────────────────────────────────────────────────────────────┘
```

**Key Architecture Points:**
- Wrapper backend does NOT specify provider — uses Core API default
- Demo UI calls wrapper backend, which calls Core API
- API docs page showcases the Core API for potential customers
- Waitlist capture routes users to signup (email + use-case)

---

## Project Setup

**IMPORTANT: Separate Repository**
This demo project must be created as a NEW, SEPARATE repository - not inside the backbone repo.

**Product vs Repository Naming:**
- **Product Name:** EverSaid (user-facing, branding)
- **Repository Name:** `eversaid` (technical, GitHub)

**Repository Names:**

| Component | Name | Visibility |
|-----------|------|------------|
| Frontend + Wrapper Backend | `eversaid` | Private |
| Core Backend API | `asr-llm-core` | Private |

**User Action Required:**
1. Create a new GitHub repository `eversaid`
2. Set visibility to private
3. Clone it locally and provide the path

**Folder Naming:**
- Use `frontend/` and `backend/` (not `demo-frontend/`, `demo-backend/`)
- Keep "demo" only in user-facing copy where it adds meaning

---

## Commit Guidelines

**Commit frequently** - after every complete, working feature/component.

**Commit message style:**
- Simple and concise
- No Claude/AI attribution
- Focus on what was done, not how
- Help other engineers understand the implementation process

**Examples of good commit messages:**
```
feat: add wrapper backend project structure
feat: implement backbone API client with JWT auth
feat: add session management with SQLite
feat: implement rate limiting middleware
feat: create Next.js project with Tailwind
feat: add landing page hero section
feat: implement side-by-side transcript comparison
feat: add diff highlighting for raw vs clean
fix: handle token refresh on 401 response
docs: add README with setup instructions
```

**Avoid:**
- `🤖 Generated with Claude Code`
- `Co-Authored-By: Claude`
- Over-explaining the implementation details
- Multiple unrelated changes in one commit

---

## Frontend Development Workflow

### V0.dev First, Claude Code Second

For all UI components, follow this workflow:

1. **Prototype in V0.dev** (https://v0.dev)
   - Generate UI components using natural language prompts
   - Iterate 3-5 times until visually satisfied
   - Use ONE V0 chat for all pages to maintain design consistency

2. **Export via shadcn CLI**
   - Copy the export command: `npx shadcn@latest add "https://v0.dev/chat/b/[ID]"`
   - Run in frontend/ directory

3. **Claude Code for Logic Only**
   - Wire up event handlers, state management, API calls
   - Implement i18n with next-intl
   - Add business logic in separate files (hooks, lib/)

### Component Architecture (Presentation/Logic Separation)

V0-generated components must be PRESENTATIONAL only (no internal state/logic).
All logic lives in separate files that are safe from V0 regeneration.

```
frontend/src/
├── components/           # V0-generated, presentation only
│   ├── landing/
│   ├── demo/
│   │   ├── DemoPage.tsx              # Props-driven, no logic
│   │   ├── UploadZone.tsx
│   │   ├── VoiceRecorder.tsx
│   │   ├── AudioPlayer.tsx           # Persistent player with seeking
│   │   ├── TranscriptCompareView.tsx # Side-by-side raw vs clean (CORE FEATURE)
│   │   ├── TranscriptPane.tsx        # Single pane (raw or clean)
│   │   ├── SegmentRow.tsx            # Individual segment with diff spans
│   │   ├── DiffSpan.tsx              # Insert/delete/replace highlighting
│   │   ├── AnalysisCard.tsx          # AI analysis display (read-only)
│   │   ├── FeedbackRating.tsx        # Quality rating component
│   │   ├── EntryHistory.tsx
│   │   └── WaitlistModal.tsx         # Email capture
│   ├── api-docs/
│   └── waitlist/
├── containers/           # YOUR CODE - wires logic to presentation
│   └── DemoPageContainer.tsx
├── features/             # YOUR CODE - business logic (safe from V0)
│   └── transcription/
│       ├── useTranscription.ts
│       ├── useAudioPlayer.ts
│       ├── useVoiceRecorder.ts
│       ├── useFeedback.ts
│       ├── useDiff.ts                # Segment-level diff computation
│       ├── useSyncScroll.ts          # Segment-index based sync
│       └── api.ts
├── lib/                  # YOUR CODE - utilities (safe from V0)
│   ├── session.ts
│   ├── storage.ts
│   └── diff.ts                       # JsDiff wrapper
└── app/                  # Next.js routes
```

### Design System Constraints (v3 - Dark Theme with Gradients)

All V0 prompts must specify:
- Hero background: Dark gradient (#0F172A → #1E3A5F → #0F172A)
- Primary Blue: #38BDF8 (Sky) - accents, links, highlights
- Primary Purple: #A855F7 (Violet) - gradient secondary
- CTA buttons: Blue-purple gradient (#38BDF8 → #A855F7)
- Section backgrounds: White (#FFFFFF) or Slate light (#F8FAFC)
- Text: Slate dark (#0F172A) for headings, Slate (#64748B) for body
- Borders: #E2E8F0
- Logo font: Comfortaa (lowercase "eversaid")
- Style: Professional European B2B, not startup-y
- Components: shadcn/ui with Vega/Nova style
- Icons: Lucide React

### Speaker Colors (Diarization)

| Speaker | Color | Hex |
|---------|-------|-----|
| Speaker 1 | Sky Blue | `#38BDF8` |
| Speaker 2 | Violet | `#A855F7` |
| Speaker 3 | Emerald | `#10B981` |
| Speaker 4 | Amber | `#F59E0B` |
| Speaker 5+ | Cycle through above | |

### Git Branch Strategy

- `main` - Production-ready only
- `develop` - Integration branch
- `feature/*` - Feature work
- `design/*` - V0 experiments (safe to break)

---

## CLAUDE.md Template

Create this file in frontend/ root:

```markdown
# EverSaid - Frontend

## Product Branding
- **Product Name:** eversaid (lowercase in display, Comfortaa font)
- **Tagline:** Smart transcription. AI listens. You decide.
- **Repository Name:** eversaid (technical only)
- **Footer Badge:** "🇸🇮 Built in Slovenia · Independent & bootstrapped"

## V0 Prototype URLs
- Landing page: [paste after creating]
- Demo page: [paste after creating]
- API docs: [paste after creating]

## Design Constraints (v3 - DO NOT DEVIATE)
- Hero: Dark gradient (#0F172A → #1E3A5F → #0F172A)
- Primary Blue: #38BDF8 (Sky) - accents, links
- Primary Purple: #A855F7 (Violet) - gradient secondary
- CTA buttons: Blue-purple gradient (#38BDF8 → #A855F7)
- Background: White #FFFFFF, Section BG: #F8FAFC
- Text: #0F172A (headings), #64748B (body)
- Style: Professional European B2B, dark theme hero
- Border radius: rounded-xl (12px) for cards
- Shadows: Soft shadows with hover lift effects

## Architecture Rules
- V0 components are PRESENTATION ONLY (no useState, no logic)
- All logic goes in features/ or hooks/
- All API calls go through features/transcription/api.ts
- Containers wire logic to presentation

## Task Isolation
- One feature per Claude Code session
- Commit after each working feature
- Create backup branch before V0 re-imports

## i18n
- Use next-intl
- All user-facing text must use translations
- Slovenian plurals: 1=one, 2=two, 3-4=few, 5+=other

## Copy Guidelines
- Product name is "eversaid" (lowercase in display, Comfortaa font)
- Language-neutral: Do NOT say "Slovenian" or imply single-language
- Spellcheck note: "Slovenian spellcheck included — more languages coming soon"
- Footer badge: "🇸🇮 Built in Slovenia · Independent & bootstrapped"
```

---

## Repository Structure (Monorepo)

```
eversaid/
├── README.md
├── .env.example
├── docker-compose.yml          # Local dev stack
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                    # Landing page
│   │   │   ├── demo/page.tsx               # Demo page (imports container)
│   │   │   ├── api-docs/page.tsx           # API documentation
│   │   │   ├── waitlist/page.tsx           # Waitlist capture
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── landing/
│   │   │   │   └── LandingPage.tsx         # V0-generated
│   │   │   ├── demo/
│   │   │   │   ├── DemoPage.tsx            # V0-generated, presentation only
│   │   │   │   ├── AudioPlayer.tsx         # Persistent player with seeking
│   │   │   │   ├── UploadZone.tsx          # Drag/drop + file picker
│   │   │   │   ├── VoiceRecorder.tsx       # MediaRecorder integration
│   │   │   │   ├── UploadProgress.tsx      # Progress bar with status
│   │   │   │   ├── TranscriptCompareView.tsx # Side-by-side comparison (CORE)
│   │   │   │   ├── TranscriptPane.tsx      # Single pane
│   │   │   │   ├── SegmentRow.tsx          # Segment with diff highlighting
│   │   │   │   ├── DiffSpan.tsx            # Insert/delete/replace spans
│   │   │   │   ├── AnalysisCard.tsx        # AI analysis (read-only)
│   │   │   │   ├── FeedbackRating.tsx      # 1-5 star rating + optional text
│   │   │   │   ├── EntryHistory.tsx        # List of past entries
│   │   │   │   ├── RateLimitInfo.tsx       # Remaining quota display
│   │   │   │   ├── ErrorDisplay.tsx        # Error state component
│   │   │   │   ├── EmptyState.tsx          # Empty state component
│   │   │   │   └── WaitlistModal.tsx       # Email + use-case capture
│   │   │   ├── api-docs/
│   │   │   │   └── ApiDocsPage.tsx         # V0-generated
│   │   │   └── ui/                         # shadcn/ui base components
│   │   ├── containers/
│   │   │   └── DemoPageContainer.tsx       # Wires logic to DemoPage
│   │   ├── features/
│   │   │   └── transcription/
│   │   │       ├── api.ts                  # API client
│   │   │       ├── useTranscription.ts     # Transcription polling hook
│   │   │       ├── useAudioPlayer.ts       # Audio playback hook
│   │   │       ├── useVoiceRecorder.ts     # Recording hook
│   │   │       ├── useFeedback.ts          # Feedback submission hook
│   │   │       ├── useRateLimits.ts        # Rate limit tracking hook
│   │   │       ├── useDiff.ts              # Segment diff computation
│   │   │       └── useSyncScroll.ts        # Synchronized scrolling
│   │   ├── lib/
│   │   │   ├── api.ts                      # Base API client with error handling
│   │   │   ├── session.ts                  # Cookie + localStorage session
│   │   │   ├── storage.ts                  # localStorage helpers
│   │   │   └── diff.ts                     # JsDiff wrapper utilities
│   │   └── messages/
│   │       ├── sl.json                     # Slovenian translations
│   │       └── en.json                     # English translations
│   ├── package.json
│   ├── tailwind.config.js
│   ├── CLAUDE.md                           # Claude Code instructions
│   └── Dockerfile
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py                       # Configurable rate limits here
│   │   ├── backbone_client.py              # Auth + API wrapper
│   │   ├── session.py                      # Session management
│   │   ├── rate_limiter.py
│   │   ├── core_api_client.py              # Core API wrapper with auth
│   │   └── routes/
│   │       ├── transcribe.py
│   │       ├── entries.py
│   │       ├── feedback.py                 # Feedback collection
│   │       └── waitlist.py                 # Waitlist capture
│   ├── requirements.txt
│   └── Dockerfile
└── docs/
    ├── ARCHITECTURE.md
    └── DEPLOYMENT.md
```

---

## Wrapper Backend Design

### Anonymous User Per Session

Each browser session gets its own anonymous Core API user. This provides complete isolation using existing Core API patterns.

**Flow:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  DAY 1: New visitor                                                     │
│  → No session cookie                                                    │
│  → Wrapper creates anon-{uuid}@demo.eversaid.local in Core API         │
│  → Wrapper stores JWT tokens in SQLite                                  │
│  → Browser gets session_id cookie (SESSION_DURATION_DAYS, HTTP-only)   │
│  → User uploads, transcribes — all tied to their anon user             │
├─────────────────────────────────────────────────────────────────────────┤
│  DAY N+1: Same visitor returns (cookie expired)                         │
│  → Treated as new visitor → new anon user                              │
│  → Old user + entries remain in Core API (preserved for analytics)     │
├─────────────────────────────────────────────────────────────────────────┤
│  RESULT                                                                 │
│  → Complete isolation via Core API's existing user_id filtering        │
│  → No wrapper-level entry filtering needed                             │
│  → Historical data preserved for product analytics                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why this approach:**
- Uses Core API's battle-tested user isolation
- No `session_entries` mapping table needed
- GET `/entries` just works (Core API filters by user_id)
- All historical entries preserved for analytics (no cleanup job)

### Session Management

```python
# SQLite schema (simplified - no session_entries table!)
sessions:
  - session_id (UUID, PK)      # Cookie value
  - core_api_email (TEXT)       # anon-{uuid}@demo.eversaid.local
  - access_token (TEXT)
  - refresh_token (TEXT)
  - token_expires_at (TIMESTAMP)
  - created_at (TIMESTAMP)
  - expires_at (TIMESTAMP)      # SESSION_DURATION_DAYS from created_at
  - ip_address (TEXT)           # For IP-based rate limiting
```

**Note:** Password is discarded after initial login — not needed for token refresh.

**Session creation (middleware):**
```python
async def get_or_create_session(request: Request, db: Session, settings: Settings) -> SessionModel:
    session_id = request.cookies.get("session_id")

    if not session_id:
        # New visitor → create anonymous user in Core API
        session_id = str(uuid4())
        email = f"anon-{session_id}@demo.eversaid.local"
        password = secrets.token_urlsafe(32)  # Random, discarded after use

        await core_api.register(email, password)
        tokens = await core_api.login(email, password)

        session = Session(
            session_id=session_id,
            core_api_email=email,
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_expires_at=tokens.expires_at,
            expires_at=datetime.now() + timedelta(days=settings.SESSION_DURATION_DAYS),
        )
        db.add(session)
        # Set cookie in response middleware
        return session

    session = db.get(Session, session_id)
    if not session or session.expires_at < datetime.now():
        # Expired → treat as new visitor
        return await create_new_session(...)

    # Refresh Core API token if needed
    if session.token_expires_at < datetime.now():
        tokens = await core_api.refresh(session.refresh_token)
        session.access_token = tokens.access_token
        session.token_expires_at = tokens.expires_at

    return session
```

**Endpoint behavior (simplified):**
- `POST /api/transcribe` → Proxy to Core API with session's JWT
- `GET /api/entries` → Proxy to Core API (user isolation handled by Core API)
- `GET /api/entries/{id}` → Proxy to Core API (returns 404 if not user's entry)
- `DELETE /api/entries/{id}` → Proxy to Core API

**No cleanup job needed.** Session rows stay in wrapper SQLite. Core API data preserved for analytics.

### Session & Rate Limiting (Configurable)

**Session duration (easily changeable in config.py):**
- `SESSION_DURATION_DAYS`: Default 7 days — how long session cookies and data persist

**Transcribe rate limit defaults (easily changeable in config.py):**
- 5 transcriptions per session per hour
- 20 transcriptions per session per day
- 20 transcriptions per IP per day
- 1000 global transcriptions per day (cost control)

**LLM/Analysis rate limits (10x transcribe - LLM calls are cheaper on Groq):**
- 50 analyses per session per hour
- 200 analyses per session per day
- 200 analyses per IP per day
- 10000 global analyses per day

**Rate Limit API Response Headers:**

All API responses include rate limit headers:
```
X-RateLimit-Limit-Hour: 5
X-RateLimit-Remaining-Hour: 3
X-RateLimit-Limit-Day: 20
X-RateLimit-Remaining-Day: 15
X-RateLimit-Reset: 1703505600
```

**When rate limited, return HTTP 429 with body:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Hourly upload limit reached",
  "limit_type": "hour",
  "retry_after": 1847,
  "limits": {
    "hour": { "limit": 5, "remaining": 0, "reset": 1703505600 },
    "day": { "limit": 20, "remaining": 15, "reset": 1703548800 }
  }
}
```

When user hits rate limits, show waitlist CTA: "Want more? Join the waitlist for extended access."

### Waitlist Capture

**SQLite schema:**
```python
waitlist:
  - id (UUID, PK)
  - email (TEXT, UNIQUE)
  - use_case (TEXT, nullable)  # Optional description
  - waitlist_type ('api_access' | 'extended_usage')
  - created_at (TIMESTAMP)
  - source_page (TEXT)  # Which page they signed up from
```

**Request:**
```json
{
  "email": "user@example.com",
  "use_case": "I'm a therapist and need longer session recordings",
  "waitlist_type": "extended_usage"
}
```

### Feedback Collection

Collect user feedback on transcription/cleanup quality for demand validation.

**SQLite schema addition:**
```python
entry_feedback:
  - id (UUID, PK)
  - session_id (FK)
  - entry_id (FK to backbone_entry_id)
  - feedback_type ('transcription' | 'cleanup' | 'analysis')
  - rating (INTEGER 1-5)  # 5=excellent, 1=very bad
  - feedback_text (TEXT, nullable)  # Optional, prompted if rating <= 3
  - created_at (TIMESTAMP)
```

**Validation:**
- `feedback_type`: required, enum ('transcription' | 'cleanup' | 'analysis')
- `rating`: required, integer 1-5
- `feedback_text`: optional, max 1000 characters
- One feedback per type per entry (upsert behavior - update if exists)

**UI Behavior:**
- Show rating prompt after transcription/cleanup/analysis completes. It must not be attention catching, but rather a visible option next to transcription/cleanup/analysis.
- If rating <= 3, expand text input: "What could be improved?"
- Feedback is optional but encouraged
- Store for analytics/product validation

### Backbone Client (Provider-Agnostic Design)
```python
class BackboneClient:
    async def transcribe(
        self,
        audio_file: UploadFile,
        # NOTE: Do NOT specify provider - use Core API default (ElevenLabs Scribe v1)
        language: str = "sl",
        enable_diarization: bool = True,
        speaker_count: int = 2,
        enable_analysis: bool = True,
        analysis_profile: str = "generic-conversation-summary",
    ) -> TranscriptionJob:
        ...
```

### Wrapper Backend API Endpoints

These are the endpoints the demo frontend uses. They proxy to the Core API.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/transcribe` | POST | Upload audio, start transcription + cleanup + analysis |
| `GET /api/transcriptions/{id}` | GET | Poll transcription status |
| `GET /api/entries` | GET | List all session entries |
| `GET /api/entries/{id}` | GET | Entry details with transcription + cleanup + analysis |
| `DELETE /api/entries/{id}` | DELETE | Delete an entry |
| `PUT /api/entries/{id}/segments/{segment_id}` | PUT | Edit or revert cleaned segment |
| `POST /api/entries/{id}/feedback` | POST | Submit quality feedback |
| `GET /api/entries/{id}/feedback` | GET | Get existing feedback for entry |
| `POST /api/waitlist` | POST | Submit waitlist signup |
| `GET /health` | GET | Health check |

**Note:** These are NOT the Core API endpoints. The wrapper backend handles session
management and proxies to the Core API internally. The API docs page
showcases the Core API for potential customers.

---

## Demo Frontend Design

### Pages

| Page | Path | Description |
|------|------|-------------|
| Landing | `/` | Marketing page with CTAs |
| Demo | `/demo` | Main transcription interface |
| API Docs | `/api-docs` | Core API documentation |
| Waitlist | `/waitlist` | Waitlist signup (also modal on other pages) |

### Landing Page Sections

**Navigation (absolute on hero):**
- Logo: SVG icon + "eversaid" text (Comfortaa font, white, lowercase)
- Links: Features, Use Cases, How It Works (white/80% opacity, hover white)
- No language toggle in nav (simplified)
- Mobile: hamburger menu

**1. Hero Section (dark gradient, full viewport height):**
- H1: "Smart transcription." + line break + gradient text span "AI listens. You decide."
- Subtitle: "AI-powered cleanup you can review, refine, and trust. See every edit. Verify against the original audio."
- Single CTA: "Try Free Demo" (gradient button with glow shadow)
- Trust note below: shield icon + "No sign-up required · Free demo available"

**2. Proof Visual Section (NEW):**
- Static mockup showing side-by-side comparison view
- Raw transcript on left, cleaned on right
- Diff highlighting (green for additions, red strikethrough for removals)
- Speaker labels with color coding
- Spellcheck demonstration: one word with orange wavy underline + dropdown with suggestions
- Caption: "Every edit visible. Every word verifiable."

**3. Features Section (Two Groups):**

*Group A: "Verify Every Word" (Verification Features)*
| Icon | Title | Description |
|------|-------|-------------|
| 🔍 | Side-by-Side Comparison | See exactly what AI changed. Raw on the left, cleaned on the right, differences highlighted. |
| 👥 | Speaker Diarization | Choose speaker count upfront. Each speaker gets color-coded labels throughout. |
| 🎧 | Audio-Linked Proof | Click any segment to jump to that moment in the audio. Verify anything in seconds. |
| ✏️ | Edit & Revert | Edit the cleaned text directly. Spellcheck highlights errors with suggested fixes. Revert individual segments to raw. |

*Group B: "Your Data, Protected" (Privacy Features)*
| Icon | Title | Description |
|------|-------|-------------|
| 🇪🇺 | GDPR Compliant | Built for European privacy standards. Your data is processed in accordance with GDPR. |
| 🔒 | Encrypted | Data encrypted in transit and at rest. Your audio and transcripts are protected. |
| 🛡️ | Data Isolation | Your transcripts are isolated and protected. No one else can access your data. |
| 🚫 | No AI Training | Your audio and transcripts are never used to train AI models. |

*Spellcheck Note (below features):* "✓ Slovenian spellcheck included — more languages coming soon"

**4. Use Cases Section (NEW):**
- Title: "Who It's For"
- Subtitle: "Professionals who need accurate, verifiable transcripts"

| Icon | Title | Description | Examples |
|------|-------|-------------|----------|
| 🧠 | Therapists & Coaches | Document sessions accurately. Speaker labels distinguish client from practitioner. | Session notes, supervision records |
| 🎤 | Journalists & Researchers | Transcribe interviews with speaker attribution. Click any quote to verify. | Interviews, field recordings |
| 💼 | Meeting Documentation | Turn recordings into clean meeting notes. Track who said what. | Team meetings, client calls |
| 👂 | Accessibility | Make recorded audio accessible as text. Convert voice messages, lectures, video content. | Lecture recordings, voice messages |

**5. How It Works Section (light gray background #F8FAFC):**
- Label: "Process" (uppercase, sky blue)
- H2: "How It Works"
- Subtitle: "From audio to verified transcript in minutes"
- Four numbered steps with gradient number circles and connecting lines:

| Step | Title | Description |
|------|-------|-------------|
| 1 | Upload or Record | Drag-drop an audio file or record directly in browser. All common formats supported. |
| 2 | Choose Speakers | Select how many speakers are in your audio for accurate diarization. |
| 3 | Compare & Edit | Review side-by-side raw vs cleaned. Edit text, revert segments, verify against audio. |
| 4 | Analyze | Get AI-powered insights from your transcript with selectable analysis profiles. |

**6. Privacy Section (NEW):**
- Headline: "Privacy Without Compromise"
- Subheadline: "Professional transcription shouldn't mean giving up control of sensitive recordings."
- Trust badges: GDPR, Encrypted, Data Isolation, No AI Training

**7. Final CTA Section (dark gradient, same as hero):**
- H2: "Ready to try smarter transcription?"
- Subtitle: "No sign-up required. See the difference for yourself."
- CTA: "Try Free Demo" (large gradient button)
- Waitlist link: "Want full encryption and higher limits? Join the waitlist →"
- Referral hint: "Refer friends, earn free credits when they sign up." (subtle text)

**8. Footer (white background with top border):**
- Left: "© 2025 eversaid" + Badge "🇸🇮 Built in Slovenia · Independent & bootstrapped"
- Right: Privacy Policy, Terms, Contact links

### API Documentation Page (`/api-docs`)

Custom Next.js page with styled code blocks showing all Core API endpoints.

**Page Structure:**
1. Hero: "Transcription API" + "Join Waitlist for API Access" CTA
2. Authentication section
3. Endpoints by category (collapsible sections)
4. Code examples (curl, Python, JavaScript)

**Contact CTA:** Waitlist modal (not mailto) to capture email + use-case

---

## Demo Page - The Core Experience

### Input Methods
1. **Drag & drop** - Drop zone for audio files
2. **File picker** - Click to browse files
3. **Voice recording** - Record directly in browser (MediaRecorder API)
   - Start/stop button with visual feedback
   - Duration display while recording
   - Preview before upload
4. **Speaker count** - User specifies number of speakers (required for diarization)

### Demo Page Flow
1. User provides audio (upload or record)
2. User specifies number of speakers
3. Show upload progress bar
4. Poll for transcription status (every 2s)
5. Display side-by-side raw vs cleaned with diff highlighting
6. Display AI analysis card (default: Conversation Summary)
7. User can switch analysis profile via dropdown in Analysis Card
8. Copy/download buttons for both versions
9. Optional: Edit cleaned segments or revert to raw
10. Entry added to "Your Transcriptions" history

---

## Results Display — CORE FEATURE

This is the **most important feature** of the product. Must be done to perfection.

### Side-by-Side Comparison Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎵 ▶ [████████████████████████████████] 00:00 / 07:14              ⬇  🔊  │
├─────────────────────────────────────────────────────────────────────────────┤
│  RAW TRANSCRIPTION                    │  CLEANED TEXT                       │
│  ──────────────────                   │  ────────────                       │
│ ┌───────────────────────────────────┐ │ ┌───────────────────────────────────┐
│ │ │ Govorec 1  00:04 - 00:33        │ │ │ │ Govorec 1  00:04 - 00:33        │
│ │ │                                 │ │ │ │                           [↩]  │
│ │ │ kulturnice nova galerija v      │ │ │ │ Kulturnice nova galerija v      │
│ │ │ ljubljani je prostore dobila    │ │ │ │ Ljubljani je prostore dobila    │
│ │ │ v stavbi v kateri je danes      │ │ │ │ v stavbi, v kateri je danes     │
│ │ │ bancni...                       │ │ │ │ bančni...                       │
│ │ └─────────────────────────────────│ │ │ └─────────────────────────────────│
│ │ │ Govorec 2  00:33 - 00:56        │ │ │ │ Govorec 2  00:33 - 00:56        │
│ │ │                                 │ │ │ │                           [↩]  │
│ │ │ ta hisa je bila zgrajena se     │ │ │ │ Ta hiša je bila zgrajena, se    │
│ │ │ pravi zacetek gradnje je bilo   │ │ │ │ pravi začetek gradnje je bilo   │
│ │ │ leta 1903...                    │ │ │ │ leta 1903...                    │
│ └───────────────────────────────────┘ │ └───────────────────────────────────┘
├─────────────────────────────────────────────────────────────────────────────┤
│  AI ANALYSIS — Conversation Summary ✓                            [Change ▼] │
│  ───────────────────────────────────                                        │
│  Summary: A discussion about the new Kulturnice gallery in Ljubljana...     │
│  Topics: architecture, history, cultural spaces                             │
│  Key Points: • Building dates to 1903 • Originally a bank • Now a gallery   │
│                                                                             │
│  Dropdown options when clicking [Change ▼]:                                 │
│  ┌─────────────────────────────────────────┐                                │
│  │ • Conversation Summary ✓                │  ← completed                   │
│  │ • Action Items & Decisions              │  ← click to run                │
│  │ • Reflection & Insights                 │  ← click to run                │
│  └─────────────────────────────────────────┘                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ⭐⭐⭐⭐☆  Rate overall quality (optional)                                 │
│  [What could be improved?                                               ]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key UX Features

**1. Synchronized Scrolling**
- Segment-index based sync (NOT scroll position ratio)
- When left pane's top visible segment index changes → scroll right to same index
- Handle cases where raw/clean have different segment counts (mapping)

**2. Diff Highlighting**
- Compute diffs per segment using JsDiff (`diff` package)
- Render insert/delete/replace spans within segment text
- Visual styling:
  - Added text: light green background
  - Removed text: light red background with strikethrough
  - Modified: combination of both

**3. Audio ↔ Text Synchronization**
- Audio player fixed/persistent at top
- Active segment highlighted during playback
- Click segment → jump audio to segment.start
- ±100ms tolerance for segment boundaries
- Use hysteresis to avoid flickering on boundary times

**4. Segment Editing (Cleaned Text Only)**
- Each cleaned segment has [↩] revert button
- Click to revert cleaned segment to raw text
- Uses Core API `PUT /api/v1/cleaned-entries/{id}` with `user_edited_text`
- Raw transcription is ALWAYS immutable

**5. Slovenian Spellcheck**
- Spelling errors highlighted/underlined in cleaned text
- Click for suggestion list
- Replace/accept suggestion
- Only for Slovenian text (detected by Core API)

**6. Analysis Card (Single View with Switcher)**

Initial analysis runs automatically with `generic-summary` profile. Users can run additional profiles via the [Change ▼] dropdown.

**UI Behavior:**
- Card header shows: `AI ANALYSIS — {Profile Label} ✓` + `[Change ▼]` button
- Dropdown shows all profiles with status:
  - Completed profiles: show ✓ checkmark, clicking switches view
  - Uncompleted profiles: clicking triggers new analysis
- When new analysis is triggered:
  - Show loading state in card
  - Poll for completion
  - Switch to new analysis when ready
- All completed analyses stored in backend (can switch between them)
- Output fields rendered dynamically based on profile's `outputs` array

**Profile Outputs:**

**Conversation Summary (generic-summary):** `summary`, `topics`, `key_points`
```json
{
  "summary": "A discussion about the new gallery in Ljubljana...",
  "topics": ["architecture", "history", "cultural spaces"],
  "key_points": ["Building dates to 1903", "Originally a bank", "Now a gallery"]
}
```

**Action Items & Decisions (action-items):** `summary`, `action_items`, `decisions`, `follow_ups`
```json
{
  "summary": "Team meeting about project timeline and resources.",
  "action_items": ["Review budget proposal by Friday", "Schedule follow-up with design team"],
  "decisions": ["Move deadline to Q2", "Hire two contractors"],
  "follow_ups": ["Confirm vendor availability", "Get budget approval"]
}
```

**Reflection & Insights (reflection):** `summary`, `themes`, `underlying_questions`, `reflection_prompts`
```json
{
  "summary": "Personal reflection on recent career changes.",
  "themes": ["transition", "uncertainty", "growth"],
  "underlying_questions": ["What truly matters in my work?", "Am I ready for this change?"],
  "reflection_prompts": ["What would success look like in 6 months?", "What are you most afraid of losing?"]
}
```

### Tech Stack for Diff + Sync UX

| Component | Library | Purpose |
|-----------|---------|---------|
| Diff engine | `diff` (JsDiff) | Segment-level diffs |
| Virtualization | `react-virtuoso` | Variable-height segments, scrollToIndex |
| Sync scrolling | Custom hook | Segment-index based sync |
| Audio sync | Custom hook | ±100ms tolerance, hysteresis |

**Implementation Notes:**

1. **diff (JsDiff)**
   - Compute diffs per segment, not whole document
   - Output is character/word-based
   - Need rendering strategy for insert/delete/replace spans

2. **react-virtuoso**
   - Use for variable-height segments
   - Reliable scrollToIndex for "jump to segment"
   - Smooth auto-follow during playback
   - Gotcha: Keep row heights stable during playback to avoid jumpiness

3. **Segment-index sync**
   - When left pane's top visible segment index changes → scroll right to same index
   - If raw/clean have different segment counts (merge/split), maintain mapping
   - Don't use scroll ratio — causes drift

4. **Audio sync**
   - Keep tolerance window (±100ms) when determining active segment
   - Use hysteresis to avoid flickering on boundary times
   - Debounce timeupdate events

### Audio Player Component

```
┌─────────────────────────────────────────────────────────────┐
│  ▶  [▁▂▃▅▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇▅▃▂▁]  02:34 / 07:14    🔊  ⬇  │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Play/pause button
- Waveform visualization (use wavesurfer.js or simple CSS bars)
- Current time / total duration
- Click waveform to seek
- Download original audio button
- Playback speed control (0.5x, 1x, 1.5x, 2x)

**Props interface:**
```typescript
interface AudioPlayerProps {
  src: string
  duration: number
  currentTime: number
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onDownload: () => void
  downloadLabel: string
}
```

### Entry History (All User Data)

Show all entries for the session (up to SESSION_DURATION_DAYS):
```
┌─────────────────────────────────────────────────────────┐
│  YOUR TRANSCRIPTIONS                                    │
│  ───────────────────                                    │
│  │ interview.mp3     │ 5:32 │ Completed │ Dec 23 │ ▶   │
│  │ meeting-notes.wav │ 12:05│ Completed │ Dec 22 │ ▶   │
│  │ voice-memo.m4a    │ 1:15 │ Completed │ Dec 21 │ ▶   │
│                                                         │
│  Data stored for {SESSION_DURATION_DAYS} days. [Clear all]  │
└─────────────────────────────────────────────────────────┘
```
- Click entry to view full transcription + cleanup + analysis
- Show duration, status, date
- Delete individual entries or clear all

### Session Handling
```typescript
// Cookie: HTTP-only, SESSION_DURATION_DAYS expiry, stores session_id
// localStorage: Caches entry list for instant display
// On load: Sync localStorage with server
```

---

## UI States

### Error States

Display user-friendly error messages. Errors from backbone API should be propagated with clear messaging.

Error display component:
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Transcription Failed                                   │
│                                                             │
│  The audio file could not be processed. This might happen   │
│  if the file is corrupted or contains no speech.            │
│                                                             │
│  [Try Again]  [Upload Different File]                       │
└─────────────────────────────────────────────────────────────┘
```

**Common error scenarios:**
- Upload failed (network error) → "Upload failed. Please check your connection and try again."
- Transcription failed (backend error) → "Transcription failed. The audio may be corrupted or too short."
- File too large (>50MB) → "File too large. Maximum size is 50MB."
- Audio too long (>5 min) → "Audio too long. Maximum duration for demo is 5 minutes."
- Unsupported format → "File type not supported. Please upload MP3, WAV, M4A, WEBM, or OGG."
- Server error → "Something went wrong on our end. Please try again later."

### Rate Limit Feedback

When user hits rate limits, show clear message with countdown + waitlist CTA:
- **Per-hour limit**: "You've reached the limit of 5 uploads per hour. Try again in {minutes} minutes."
- **Per-day limit**: "Daily limit reached (20 uploads). Try again tomorrow."
- **Global limit**: "Service is busy. Please try again later."

```
┌─────────────────────────────────────────────────────────────┐
│  4 of 5 uploads remaining this hour • 15 of 20 today       │
│                                                             │
│  [Want more? Join the waitlist for extended access →]      │
└─────────────────────────────────────────────────────────────┘
```

### Empty States

**No entries yet (first-time user):**
```
┌─────────────────────────────────────────────────────────────┐
│                         🎙️                                  │
│                                                             │
│           No transcriptions yet                             │
│                                                             │
│     Upload an audio file or record your voice               │
│              to get started                                 │
│                                                             │
│     Supported: MP3, WAV, M4A • Max 50MB • Max 5 minutes    │
└─────────────────────────────────────────────────────────────┘
```

**History empty (session expired or cleared):**
```
┌─────────────────────────────────────────────────────────────┐
│  Your previous transcriptions have expired.                 │
│  Start fresh by uploading a new file.                       │
└─────────────────────────────────────────────────────────────┘
```

### Toast Notifications

Use shadcn/ui Sonner (preferred) or Toast component for brief confirmations:
- ✓ "Copied to clipboard"
- ✓ "Downloaded transcription.txt"
- ✓ "Feedback submitted. Thank you!"
- ✓ "Entry deleted"
- ✓ "Segment reverted to original"
- ✗ "Failed to copy. Please try again."

---

## Core API Endpoints (for API Docs Page)

The API docs page showcases these Core API endpoints for potential customers.

### Authentication Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/auth/register` | POST | No | Register new user account |
| `/api/v1/auth/login` | POST | No | Login, receive JWT tokens |
| `/api/v1/auth/refresh` | POST | No | Refresh access token |

**Auth flow:** Register → Login → Use Bearer token → Refresh when expired

---

### Main Workflow Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/upload-transcribe-cleanup` | POST | Yes | **Complete workflow** - upload, transcribe, cleanup, analysis |
| `/api/v1/upload-and-transcribe` | POST | Yes | Upload + transcribe only (no cleanup) |

**upload-transcribe-cleanup Parameters:**
- `file` (required): Audio file (MP3, WAV, M4A, max 100MB)
- `language`: Language code (`sl`, `en`, `auto`)
- `entry_type`: `dream`, `journal`, `meeting`, `note`
- `enable_diarization`: boolean
- `speaker_count`: 1-10
- `transcription_temperature`: 0.0-1.0
- `cleanup_temperature`: 0.0-2.0
- `enable_analysis`: boolean
- `analysis_profile`: Profile ID (default: `generic-conversation-summary`)

**Response:**
```json
{
  "entry_id": "uuid",
  "transcription_id": "uuid",
  "cleanup_id": "uuid",
  "analysis_id": "uuid",
  "transcription_status": "processing",
  "cleanup_status": "pending",
  "analysis_status": "pending"
}
```

---

### Entry Management Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/entries` | GET | Yes | List all entries (paginated) |
| `/api/v1/entries/{id}` | GET | Yes | Get entry with transcription |
| `/api/v1/entries/{id}/audio` | GET | Yes | Download audio file |
| `/api/v1/entries/{id}/cleaned` | GET | Yes | List cleaned entries |
| `/api/v1/entries/{id}/analyses` | GET | Yes | List analyses for entry |
| `/api/v1/entries/{id}` | DELETE | Yes | Delete entry + all data |

---

### Transcription Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/transcriptions/{id}` | GET | Yes | Get status + text + segments |
| `/api/v1/transcriptions/{id}/cleanup` | POST | Yes | Start LLM cleanup |
| `/api/v1/transcriptions/{id}/set-primary` | PUT | Yes | Set as primary |
| `/api/v1/transcriptions/{id}` | DELETE | Yes | Delete transcription |

**Status values:** `pending`, `processing`, `completed`, `failed`

---

### Cleanup Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/cleaned-entries/{id}` | GET | Yes | Get cleaned text (with spellcheck for Slovenian) |
| `/api/v1/cleaned-entries/{id}` | PUT | Yes | Update cleaned text (user edits) |
| `/api/v1/cleaned-entries/{id}` | DELETE | Yes | Delete cleaned entry |

---

### Analysis Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/analysis-profiles` | GET | No | List available analysis profiles |
| `/api/v1/cleaned-entries/{id}/analyze` | POST | Yes | Start analysis on cleaned entry |
| `/api/v1/analyses/{id}` | GET | Yes | Get analysis status + results |

### Analysis Profiles

Analysis profiles define how the AI analyzes cleaned transcription text. Users select a profile instead of writing prompts, keeping analysis safe and consistent.

**Available Profiles:**

| Profile ID | Label | Intent | Best For |
|------------|-------|--------|----------|
| `generic-summary` | Conversation Summary | summarization | General recordings, interviews |
| `action-items` | Action Items & Decisions | task_extraction | Meetings, planning sessions |
| `reflection` | Reflection & Insights | self_discovery | Personal recordings, coaching |

**Profile Response Structure:**

```json
{
  "profiles": [
    {
      "id": "generic-summary",
      "label": "Conversation Summary",
      "intent": "summarization",
      "description": "Extracts main topics, key points, and a brief summary.",
      "is_default": true,
      "outputs": ["summary", "key_points", "topics"]
    },
    {
      "id": "action-items",
      "label": "Action Items & Decisions",
      "intent": "task_extraction",
      "description": "Identifies tasks, decisions made, and follow-up items.",
      "is_default": false,
      "outputs": ["summary", "action_items", "decisions", "follow_ups"]
    },
    {
      "id": "reflection",
      "label": "Reflection & Insights",
      "intent": "self_discovery",
      "description": "Explores themes, underlying questions, and prompts for deeper thinking.",
      "is_default": false,
      "outputs": ["summary", "themes", "underlying_questions", "reflection_prompts"]
    }
  ]
}
```

**Profile Configuration (TOML):**

Profiles are defined in `config/analysis_profiles.toml` with this structure:
- `id`: Unique identifier (used in API requests)
- `label`: Human-readable name (displayed to users)
- `intent`: Purpose category (for documentation/filtering)
- `constraints`: List of guardrails for the LLM
- `outputs`: Expected JSON keys in the analysis result
- `prompt`: LLM prompt template (contains `{cleaned_text}` placeholder)

**Demo Workflow:**
- Initial upload always uses `generic-summary` (Conversation Summary)
- After cleanup completes, Analysis Card shows with [Change ▼] dropdown
- Users can trigger additional profiles from the dropdown
- Completed profiles show ✓, uncompleted show as "click to run"
- All analyses stored in backend, users can switch between completed ones

---

### Discovery Endpoints (Public)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/options` | GET | No | Get available models + parameters |
| `/api/v1/models/languages` | GET | No | List 99+ supported languages |
| `/api/v1/analysis-profiles` | GET | No | List available analysis profiles |

---

### System Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/docs` | GET | No | Swagger UI |
| `/redoc` | GET | No | ReDoc |
| `/openapi.json` | GET | No | OpenAPI spec |

---

### Code Examples Section

Show curl, Python (requests), and JavaScript (fetch) examples for:
1. Login and get token
2. Upload and transcribe with diarization
3. Poll for status
4. Get results with segments
5. Edit cleaned text

---

## Backbone (Core API) Changes Required

### 1. Create Demo User
```sql
INSERT INTO journal.users (email, hashed_password, role, is_active)
VALUES ('demo@eversaid.local', '<bcrypt_hash>', 'user', true);
```

### 2. Analysis Feature (if not already implemented)
See `docs/analysis-feature.md` for complete specification including:
- Analysis profiles table
- Endpoints
- Database schema

### 3. Segment-Level Cleanup Storage
Ensure cleanup stores segments aligned with transcription segments for diff comparison.

---

## Diarization

### User Specifies Speaker Count

User must specify the number of speakers before transcription:
- Input field or dropdown (1-10 speakers)
- Required for diarization to work properly

### Single Speaker Mode (No Diarization)

When `speaker_count = 1`, the API does NOT return speaker segments:
- No `speaker` or `speaker_id` fields in segments
- No colored left borders on segments
- Simplified UI: just timestamped text blocks
- Same side-by-side layout, but without speaker labels

**UI must handle both cases gracefully:**

```
┌───────────────────────────────────────────────────────────────────────────┐
│  MULTI-SPEAKER (speaker_count > 1)    │  SINGLE SPEAKER (speaker_count=1) │
│  ─────────────────────────────────    │  ──────────────────────────────── │
│  ┌─────────────────────────────────┐  │  ┌─────────────────────────────────┐
│  │ │ Govorec 1  00:04 - 00:33     │  │  │ 00:04 - 00:33                   │
│  │ │ (colored left border)        │  │  │ (no speaker, no colored border) │
│  │ │ Text here...                 │  │  │ Text here...                    │
│  └─────────────────────────────────┘  │  └─────────────────────────────────┘
│  ┌─────────────────────────────────┐  │  ┌─────────────────────────────────┐
│  │ │ Govorec 2  00:33 - 00:56     │  │  │ 00:33 - 00:56                   │
│  │ │ (different color)            │  │  │                                 │
│  │ │ Text here...                 │  │  │ Text here...                    │
│  └─────────────────────────────────┘  │  └─────────────────────────────────┘
└───────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Check if segment has `speaker_id` field
- If present: render speaker label + colored border
- If absent: render timestamp only, neutral styling

### API Response Format

```json
{
  "transcription": {
    "text": "Full transcription text...",
    "segments": [
      {
        "start": 0.0,
        "end": 33.0,
        "text": "Kulturnice nova galerija v Ljubljani...",
        "speaker": "Govorec 1",
        "speaker_id": 0
      },
      {
        "start": 33.0,
        "end": 56.0,
        "text": "Ta hiša je bila zgrajena...",
        "speaker": "Govorec 2",
        "speaker_id": 1
      }
    ],
    "diarization_applied": true,
    "speaker_count": 2
  },
  "cleanup": {
    "text": "Full cleaned text...",
    "segments": [
      {
        "start": 0.0,
        "end": 33.0,
        "text": "Kulturnice nova galerija v Ljubljani...",
        "speaker": "Govorec 1",
        "speaker_id": 0,
        "raw_segment_id": "segment-0"
      }
    ]
  }
}
```

### Speaker Color Assignment

Assign consistent colors per speaker_id for left border:
- Speaker 0: Blue (#3B82F6)
- Speaker 1: Green (#10B981)
- Speaker 2: Purple (#8B5CF6)
- Speaker 3: Orange (#F59E0B)
- Speaker 4+: Cycle through palette

---

## Deployment

### Recommended Stack
- **Frontend**: Vercel (free tier, auto-deploy from GitHub)
- **Wrapper Backend**: Railway ($5/mo hobby, or free tier to start)
- **Core API**: Your existing server

### Docker Compose (Local Dev)
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8001

  backend:
    build: ./backend
    ports: ["8001:8001"]
    environment:
      BACKBONE_URL: http://host.docker.internal:8000
      DEMO_USER_EMAIL: demo@eversaid.local
      DEMO_USER_PASSWORD: ${DEMO_PASSWORD}
      # Session duration (configurable)
      SESSION_DURATION_DAYS: 7
      # Transcribe rate limits (configurable)
      RATE_LIMIT_HOUR: 5
      RATE_LIMIT_DAY: 20
      RATE_LIMIT_IP_DAY: 20
      RATE_LIMIT_GLOBAL_DAY: 1000
      # LLM/Analysis rate limits (10x transcribe)
      RATE_LIMIT_LLM_HOUR: 50
      RATE_LIMIT_LLM_DAY: 200
      RATE_LIMIT_LLM_IP_DAY: 200
      RATE_LIMIT_LLM_GLOBAL_DAY: 10000
    volumes:
      - ./data:/app/data  # SQLite

  # Core API runs separately on your server
```

---

## Implementation Phases

### Phase 1: Wrapper Backend (4-6 hours)
1. FastAPI project setup with config (configurable rate limits)
2. Core API client with anonymous user creation + JWT management
3. Session management (SQLite)
4. Rate limiting middleware
5. Waitlist capture endpoint
6. `/transcribe`, `/entries` endpoints
7. Feedback endpoint

### Phase 2: Demo Frontend (12-15 hours)

**2a. V0 Prototyping (2-3 hours)**
1. Generate Landing Page in V0.dev (one V0 chat)
2. Generate Demo Page - side-by-side comparison layout (same chat)
3. Generate segment row with diff highlighting (same chat)
4. Generate API Docs Page (same chat)
5. Generate Waitlist modal (same chat)
6. Iterate until visually consistent across all pages
7. Export all components via shadcn CLI commands

**2b. Project Setup (1-2 hours)**
1. Next.js + Tailwind + shadcn/ui initialization (Vega style)
2. Install dependencies: `diff`, `react-virtuoso`
3. Import V0 components via CLI
4. Set up folder structure (components/, containers/, features/, lib/)
5. Create CLAUDE.md with design constraints
6. Set up git branches (main, develop)
7. Configure next-intl for i18n

**2c. Logic Implementation (7-8 hours)** - Fresh Claude Code context per task
1. Task: Session management hook + localStorage sync
2. Task: API client with error handling and rate limit parsing
3. Task: useTranscription hook with polling logic
4. Task: useAudioPlayer hook with seeking + segment sync
5. Task: useVoiceRecorder hook with MediaRecorder
6. Task: useDiff hook for segment-level diff computation
7. Task: useSyncScroll hook for segment-index based sync
8. Task: TranscriptCompareView container with all hooks wired
9. Task: useFeedback hook for rating submission
10. Task: Waitlist modal with form validation
11. Task: i18n message files (sl.json, en.json) with Slovenian plurals

**2d. Visual QA & Polish (1-2 hours)**
1. Playwright MCP screenshot verification (ABSOLUTELY NECESSARY)
2. Test all UI states (empty, loading, error, success, rate limited)
3. Test side-by-side comparison with real transcripts
4. Test segment sync scrolling
5. Test audio ↔ text sync
6. Responsive testing (mobile, tablet, desktop) - desktop first
7. Slovenian character rendering verification (č, š, ž)
8. Test language switching

### Phase 3: Integration & Docker (2-3 hours)
1. Dockerfiles for both services
2. docker-compose.yml for local dev
3. End-to-end testing
4. Environment variable documentation

### Phase 4: Deployment (2 hours)
1. Deploy frontend to Vercel
2. Deploy backend to Railway
3. Configure environment variables
4. Test production flow

### Phase 5: Documentation (1-2 hours)
1. README with setup instructions
2. Architecture diagram
3. API documentation
4. Sample audio files for testing

---

## Visual Testing with Playwright MCP

**Automated Screenshot Capture + AI Evaluation**

Claude Code can use Playwright MCP to capture screenshots and evaluate the UI automatically.

**Setup:**
```bash
claude mcp add playwright npx @playwright/mcp@latest
```

**Workflow:**
1. After making UI changes, tell Claude: "Take a screenshot of the demo page"
2. Playwright opens browser, navigates to localhost:3000, captures screenshot
3. Screenshot is fed back to Claude for evaluation
4. Claude can compare against reference images or evaluate for visual issues

**Screenshot Storage:**
```
frontend/
├── screenshots/
│   ├── 2024-12-27_landing_hero.png
│   ├── 2024-12-27_demo_comparison.png
│   └── ...
```

**Example prompts for visual testing:**
- "Take screenshots of all pages and save to screenshots folder"
- "Compare the current side-by-side view to the design spec"
- "Check if diff highlighting is visible and properly styled"
- "Capture the demo flow: upload → processing → results"

---

## TODOs for Review

- [x] **Spellcheck feature**: Core API supports Slovenian spellcheck on cleaned entries
- [x] **Analysis feature**: See `docs/analysis-feature.md` for technical specification
- [ ] **Diarization**: Ensure Core API returns segment-aligned cleanup for diff comparison
- [ ] **Segment editing**: Core API `PUT /api/v1/cleaned-entries/{id}` with `user_edited_text`

---

## Key Files to Reference

**Design Reference:**
- `docs/eversaid//landing-page-mockup-v3.html` - Current v3 landing page design

**Core API (asr-llm-core) files for integration:**
- `app/routes/upload.py` - upload-transcribe-cleanup endpoint
- `app/routes/auth.py` - JWT auth flow
- `app/routes/cleaned_entries.py` - cleanup with spellcheck
- `app/services/provider_registry.py` - provider configuration
- `docs/analysis-feature.md` - analysis profiles and endpoints
- `docs/api-reference.md` - complete API documentation

---

## Changelog
- 2025-12-29: v3 design update - lowercase "eversaid" branding, dark gradient hero, blue/purple color scheme, Step 4 "Analyze", referral system, footer badge
