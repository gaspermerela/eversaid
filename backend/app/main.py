from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.core_client import CoreAPIClient, CoreAPIError
from app.database import Base, engine
from app import models  # noqa: F401 - Import models to register them with Base
from app.rate_limit import RateLimitExceeded
from app.routes.core import router as core_router
from app.routes.local import router as local_router


# =============================================================================
# Rate Limit Middleware
# =============================================================================


class RateLimitHeaderMiddleware(BaseHTTPMiddleware):
    """Add rate limit headers to all responses from rate-limited endpoints.

    Design Decision: Middleware for headers
    -----------------------------------------
    Using middleware is the cleanest way to add headers to ALL responses,
    including both success (200) and error (4xx/5xx) responses. The alternative
    of adding headers in each endpoint would miss error responses and create
    duplication.

    The rate_limit_result is stored in request.state by the require_rate_limit
    dependency, making it available here.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add rate limit headers if result is available
        if hasattr(request.state, "rate_limit_result"):
            result = request.state.rate_limit_result
            response.headers["X-RateLimit-Limit-Day"] = str(result.day.limit)
            response.headers["X-RateLimit-Remaining-Day"] = str(result.day.remaining)
            response.headers["X-RateLimit-Reset"] = str(result.day.reset)

        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize resources on startup, cleanup on shutdown."""
    # Create database tables
    Base.metadata.create_all(bind=engine)

    # Initialize Core API client
    settings = get_settings()
    app.state.core_api = CoreAPIClient(base_url=settings.CORE_API_URL)

    yield

    # Cleanup: close Core API client
    await app.state.core_api.close()


app = FastAPI(
    title="Eversaid Wrapper API",
    description="Wrapper backend for Eversaid demo - handles sessions, rate limiting, and feedback",
    version="0.1.0",
    lifespan=lifespan,
)

# Register routers
app.include_router(core_router)
app.include_router(local_router)

# Register middleware
app.add_middleware(RateLimitHeaderMiddleware)


# Exception handlers
@app.exception_handler(CoreAPIError)
async def core_api_error_handler(request: Request, exc: CoreAPIError) -> JSONResponse:
    """Convert CoreAPIError to HTTP response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Convert RateLimitExceeded to HTTP 429 response with headers."""
    result = exc.result
    headers = {
        "X-RateLimit-Limit-Day": str(result.day.limit),
        "X-RateLimit-Remaining-Day": str(result.day.remaining),
        "X-RateLimit-Reset": str(result.day.reset),
        "Retry-After": str(result.retry_after),
    }
    return JSONResponse(
        status_code=429,
        content=exc.detail,
        headers=headers,
    )


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
