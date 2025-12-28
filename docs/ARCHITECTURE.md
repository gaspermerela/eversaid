# Architecture

## Overview

Smart Transcribe is a monorepo containing:

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
- Presentation layer with V0-generated components
- Business logic in features/ and lib/
- Internationalization with next-intl (sl/en)

### Wrapper Backend
- Session management with SQLite
- Rate limiting (configurable)
- Proxies requests to Core API

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
