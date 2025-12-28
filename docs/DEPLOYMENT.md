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
cd backend && uvicorn app.main:app --reload --port 8001
```

## Environment Variables

### Frontend
- `NEXT_PUBLIC_API_URL` - Wrapper backend URL

### Backend
- `BACKBONE_URL` - Core API URL
- `DEMO_USER_EMAIL` - Demo user email
- `DEMO_USER_PASSWORD` - Demo user password
- `RATE_LIMIT_HOUR` - Uploads per hour (default: 5)
- `RATE_LIMIT_DAY` - Uploads per day (default: 20)
- `RATE_LIMIT_IP_DAY` - Uploads per IP per day (default: 100)
- `RATE_LIMIT_GLOBAL_DAY` - Global daily limit (default: 1000)

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
