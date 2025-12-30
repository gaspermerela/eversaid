"""Test fixtures for the backend."""

from typing import Generator

import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.core_client import CoreAPIClient
from app.database import Base, get_db
from app.main import app


@pytest.fixture
def test_settings() -> Settings:
    """Override settings for testing."""
    return Settings(
        CORE_API_URL="http://core-api:8000",
        SESSION_DURATION_DAYS=7,
        RATE_LIMIT_HOUR=5,
        RATE_LIMIT_DAY=20,
        RATE_LIMIT_IP_DAY=100,
        RATE_LIMIT_GLOBAL_DAY=1000,
        DATABASE_URL="sqlite://",  # in-memory
    )


@pytest.fixture
def test_engine():
    """Create an in-memory SQLite engine for testing."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def test_db(test_engine) -> Generator[Session, None, None]:
    """Create a database session for testing."""
    TestingSessionLocal = sessionmaker(bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def mock_core_api_client(test_settings: Settings) -> Generator[CoreAPIClient, None, None]:
    """Create a CoreAPIClient instance for testing."""
    client = CoreAPIClient(base_url=test_settings.CORE_API_URL)
    yield client
    # Cleanup happens via garbage collection since we can't await in fixture


@pytest.fixture
def client(test_engine, test_settings: Settings) -> Generator[TestClient, None, None]:
    """Create a test client with mocked database and settings."""
    TestingSessionLocal = sessionmaker(bind=test_engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = lambda: test_settings

    # Create mock Core API client
    core_api = CoreAPIClient(base_url=test_settings.CORE_API_URL)
    app.state.core_api = core_api

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def mock_core_api(test_settings: Settings):
    """Mock all Core API calls with respx.

    Provides mock responses that match actual Core API schemas.
    """
    with respx.mock:
        # Register endpoint - returns user object
        respx.post(f"{test_settings.CORE_API_URL}/api/v1/auth/register").mock(
            return_value=Response(
                201,
                json={
                    "id": "user-123",
                    "email": "anon-test@demo.eversaid.local",
                    "is_active": True,
                    "role": "user",
                    "created_at": "2025-01-01T00:00:00Z",
                },
            )
        )

        # Login endpoint - returns tokens
        respx.post(f"{test_settings.CORE_API_URL}/api/v1/auth/login").mock(
            return_value=Response(
                200,
                json={
                    "access_token": "test-access-token",
                    "refresh_token": "test-refresh-token",
                    "token_type": "bearer",
                    "user": {
                        "id": "user-123",
                        "email": "anon-test@demo.eversaid.local",
                        "is_active": True,
                        "role": "user",
                        "created_at": "2025-01-01T00:00:00Z",
                    },
                },
            )
        )

        # Refresh endpoint - returns new tokens
        respx.post(f"{test_settings.CORE_API_URL}/api/v1/auth/refresh").mock(
            return_value=Response(
                200,
                json={
                    "access_token": "new-access-token",
                    "refresh_token": "new-refresh-token",
                    "token_type": "bearer",
                    "user": {
                        "id": "user-123",
                        "email": "anon-test@demo.eversaid.local",
                        "is_active": True,
                        "role": "user",
                        "created_at": "2025-01-01T00:00:00Z",
                    },
                },
            )
        )

        yield
