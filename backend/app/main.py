from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.config import get_settings
from app.core_client import CoreAPIClient
from app.database import Base, engine
from app import models  # noqa: F401 - Import models to register them with Base


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


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
