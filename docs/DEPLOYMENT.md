# Deployment

## Recommended Stack

- **Frontend**: Vercel (free tier, auto-deploy from GitHub)
- **Wrapper Backend**: Railway ($5/mo hobby, or free tier)
- **Core API**: Your existing server

## Local Development

```bash
# Start with Docker Compose
docker-compose up

# Or run individually:
# Frontend
cd frontend && npm run dev

# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8001
```

## Frontend Commands

```bash
cd frontend

# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # Run ESLint

# Testing
npm run test             # Unit tests (watch mode)
npm run test:run         # Unit tests (single run)
npm run test:e2e         # E2E tests (headless)
npm run test:e2e:ui      # E2E tests (UI mode)

# Component Development
npm run storybook        # Start Storybook (localhost:6006)
npm run build-storybook  # Build static Storybook
```

## Environment Variables

### Frontend
- `NEXT_PUBLIC_API_URL` - Wrapper backend URL

### Backend
- `CORE_API_URL` - Core API URL (default: `http://localhost:8000`)
- `DATABASE_URL` - SQLite path (default: `sqlite:///./data/demo.db`)
- `SESSION_DURATION_DAYS` - Session lifetime (default: 7)
- `RATE_LIMIT_HOUR` - Uploads per hour per session (default: 5)
- `RATE_LIMIT_DAY` - Uploads per day per session (default: 20)
- `RATE_LIMIT_IP_DAY` - Uploads per IP per day (default: 100)
- `RATE_LIMIT_GLOBAL_DAY` - Global daily limit (default: 1000)

## CI/CD

GitHub Actions runs on every PR:
- Linting
- Unit tests (Vitest)
- Build verification
- Storybook build
- E2E tests (Playwright)

See `.github/workflows/pr-tests.yml` for configuration.

## Vercel Deployment

1. Connect repository to Vercel
2. Set root directory to `frontend`
3. Configure environment variables
4. Deploy

## Railway Deployment

1. Create new project
2. Connect repository
3. Set root directory to `backend`
4. Configure environment variables
5. Deploy
