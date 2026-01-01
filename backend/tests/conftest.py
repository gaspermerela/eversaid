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


@pytest.fixture
def test_settings() -> Settings:
    """Override settings for testing."""
    return Settings(
        CORE_API_URL="http://core-api:8000",
        SESSION_DURATION_DAYS=7,
        # Transcribe rate limits
        RATE_LIMIT_DAY=20,
        RATE_LIMIT_IP_DAY=20,
        RATE_LIMIT_GLOBAL_DAY=1000,
        # LLM rate limits (10x transcribe)
        RATE_LIMIT_LLM_DAY=200,
        RATE_LIMIT_LLM_IP_DAY=200,
        RATE_LIMIT_LLM_GLOBAL_DAY=10000,
        DATABASE_URL="sqlite://",  # in-memory
    )


@pytest.fixture
def test_engine():
    """Create an in-memory SQLite engine for testing."""
    # Import models to ensure they're registered with Base
    from app import models  # noqa: F401

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
    """Create a test client with mocked database, settings, and Core API.

    This fixture sets up respx mocking internally to ensure proper ordering.
    Use test_settings to add additional mocks in tests.
    """
    from app.main import app as fastapi_app
    import app.main as main_module

    TestingSessionLocal = sessionmaker(bind=test_engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Clear the lru_cache to ensure test settings are used in lifespan
    get_settings.cache_clear()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[get_settings] = lambda: test_settings

    # Patch get_settings at module level for lifespan (which calls it directly)
    original_get_settings = main_module.get_settings
    main_module.get_settings = lambda: test_settings

    # Start respx mocking with base auth mocks
    with respx.mock:
        # Register endpoint - returns user object
        respx.post(f"{test_settings.CORE_API_URL}/api/v1/auth/register").mock(
            return_value=Response(
                201,
                json={
                    "id": "user-123",
                    "email": "anon-test@anon.eversaid.example",
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
                        "email": "anon-test@anon.eversaid.example",
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
                        "email": "anon-test@anon.eversaid.example",
                        "is_active": True,
                        "role": "user",
                        "created_at": "2025-01-01T00:00:00Z",
                    },
                },
            )
        )

        with TestClient(fastapi_app, raise_server_exceptions=False) as test_client:
            yield test_client

    # Restore original
    main_module.get_settings = original_get_settings
    fastapi_app.dependency_overrides.clear()
    get_settings.cache_clear()


