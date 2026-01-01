"""Tests for rate limiting functionality.

Tests cover all three rate limit tiers:
- Session per day
- IP per day
- Global per day

And both endpoints:
- POST /api/transcribe (transcribe limits)
- POST /api/cleaned-entries/{id}/analyze (LLM limits - 10x transcribe)
"""

import io
from datetime import datetime, timedelta

import pytest
import respx
from httpx import Response

from app.models import RateLimitEntry


# =============================================================================
# Fixtures for Rate Limit Testing
# =============================================================================


@pytest.fixture
def rate_limit_settings():
    """Settings with very low rate limits for testing."""
    from app.config import Settings

    return Settings(
        CORE_API_URL="http://core-api:8000",
        SESSION_DURATION_DAYS=7,
        # Very low limits for testing
        RATE_LIMIT_DAY=3,
        RATE_LIMIT_IP_DAY=4,
        RATE_LIMIT_GLOBAL_DAY=5,
        # LLM limits (10x for testing)
        RATE_LIMIT_LLM_DAY=30,
        RATE_LIMIT_LLM_IP_DAY=40,
        RATE_LIMIT_LLM_GLOBAL_DAY=50,
        DATABASE_URL="sqlite://",
    )


@pytest.fixture
def rate_limited_client(test_engine, rate_limit_settings):
    """Test client with low rate limits for testing."""
    from typing import Generator

    import respx
    from fastapi.testclient import TestClient
    from httpx import Response
    from sqlalchemy.orm import Session, sessionmaker

    from app.config import get_settings
    from app.database import get_db
    from app.main import app as fastapi_app
    import app.main as main_module

    TestingSessionLocal = sessionmaker(bind=test_engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    get_settings.cache_clear()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[get_settings] = lambda: rate_limit_settings

    original_get_settings = main_module.get_settings
    main_module.get_settings = lambda: rate_limit_settings

    with respx.mock:
        # Auth mocks
        respx.post(f"{rate_limit_settings.CORE_API_URL}/api/v1/auth/register").mock(
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
        respx.post(f"{rate_limit_settings.CORE_API_URL}/api/v1/auth/login").mock(
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
        respx.post(f"{rate_limit_settings.CORE_API_URL}/api/v1/auth/refresh").mock(
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

    main_module.get_settings = original_get_settings
    fastapi_app.dependency_overrides.clear()
    get_settings.cache_clear()


def mock_transcribe_success(settings):
    """Add mock for successful transcribe endpoint."""
    respx.post(f"{settings.CORE_API_URL}/api/v1/upload-transcribe-cleanup").mock(
        return_value=Response(
            202,
            json={
                "entry_id": "entry-123",
                "original_filename": "test.mp3",
                "saved_filename": "saved-test.mp3",
                "duration_seconds": 120.5,
                "entry_type": "journal",
                "uploaded_at": "2025-01-01T00:00:00Z",
                "transcription_id": "trans-123",
                "transcription_status": "processing",
                "transcription_language": "sl",
                "cleanup_id": "cleanup-123",
                "cleanup_status": "pending",
                "cleanup_model": "llama3",
                "analysis_id": "analysis-123",
                "analysis_status": "pending",
                "analysis_profile": "generic-conversation-summary",
                "message": "Upload successful, processing started",
            },
        )
    )


def mock_analyze_success(settings):
    """Add mock for successful analyze endpoint."""
    respx.post(
        f"{settings.CORE_API_URL}/api/v1/cleaned-entries/cleanup-123/analyze"
    ).mock(
        return_value=Response(
            200,
            json={
                "id": "analysis-123",
                "cleaned_entry_id": "cleanup-123",
                "profile_id": "generic-conversation-summary",
                "profile_label": "Conversation Summary",
                "status": "processing",
                "created_at": "2025-01-01T00:00:00Z",
                "message": "Analysis started",
            },
        )
    )


def do_transcribe(client):
    """Helper to make a transcribe request."""
    files = {"file": ("test.mp3", io.BytesIO(b"fake audio"), "audio/mpeg")}
    return client.post("/api/transcribe", files=files)


def do_analyze(client):
    """Helper to make an analyze request."""
    return client.post("/api/cleaned-entries/cleanup-123/analyze")


# =============================================================================
# Session Daily Limit Tests
# =============================================================================


class TestRateLimitTranscribeSessionDay:
    """Tests for transcribe session daily rate limit."""

    def test_allows_requests_under_limit(self, rate_limited_client, rate_limit_settings):
        """Requests under daily limit should succeed."""
        mock_transcribe_success(rate_limit_settings)

        # First request should succeed
        response = do_transcribe(rate_limited_client)
        assert response.status_code == 202

        # Second request (under limit of 3) should succeed
        response = do_transcribe(rate_limited_client)
        assert response.status_code == 202

    def test_blocks_at_daily_limit(self, rate_limited_client, rate_limit_settings, test_engine):
        """Request at daily limit should be blocked."""
        from sqlalchemy.orm import sessionmaker

        mock_transcribe_success(rate_limit_settings)

        # First, get a session by making a request
        do_transcribe(rate_limited_client)

        # Get the session_id from the database
        TestingSessionLocal = sessionmaker(bind=test_engine)
        db = TestingSessionLocal()
        entries = db.query(RateLimitEntry).all()
        session_id = entries[0].session_id
        ip_address = entries[0].ip_address

        # Add entries from "earlier today" (still within day)
        for _ in range(2):  # day limit is 3, we already have 1
            entry = RateLimitEntry(
                session_id=session_id,
                ip_address=ip_address,
                action="transcribe",
                created_at=datetime.utcnow() - timedelta(hours=2),
            )
            db.add(entry)
        db.commit()
        db.close()

        # Now daily count is 3 (at limit)
        # Next request should hit daily limit
        response = do_transcribe(rate_limited_client)
        assert response.status_code == 429

        data = response.json()
        assert data["limit_type"] == "day"

    def test_429_includes_limit_type(self, rate_limited_client, rate_limit_settings):
        """429 response should indicate which limit was exceeded."""
        mock_transcribe_success(rate_limit_settings)

        # Exhaust daily limit (limit is 3)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)

        response = do_transcribe(rate_limited_client)
        data = response.json()

        assert data["error"] == "rate_limit_exceeded"
        assert data["limit_type"] == "day"
        assert "Daily limit" in data["message"]


# =============================================================================
# IP Daily Limit Tests
# =============================================================================


class TestRateLimitTranscribeIPDay:
    """Tests for transcribe IP daily rate limit."""

    def test_ip_limit_across_sessions(self, rate_limited_client, rate_limit_settings, test_engine):
        """IP limit should count requests from different sessions with same IP."""
        from sqlalchemy.orm import sessionmaker

        mock_transcribe_success(rate_limit_settings)

        # Make first request to establish the IP
        do_transcribe(rate_limited_client)

        # Get IP from the entry
        TestingSessionLocal = sessionmaker(bind=test_engine)
        db = TestingSessionLocal()
        entries = db.query(RateLimitEntry).all()
        ip_address = entries[0].ip_address

        # Add entries from "other sessions" with same IP
        for i in range(3):  # IP day limit is 4, we have 1
            entry = RateLimitEntry(
                session_id=f"other-session-{i}",
                ip_address=ip_address,
                action="transcribe",
                created_at=datetime.utcnow() - timedelta(hours=2),
            )
            db.add(entry)
        db.commit()
        db.close()

        # Now IP day count is 4 (at limit), session daily still low
        response = do_transcribe(rate_limited_client)
        assert response.status_code == 429

        data = response.json()
        assert data["limit_type"] == "ip_day"


# =============================================================================
# Global Daily Limit Tests
# =============================================================================


class TestRateLimitTranscribeGlobalDay:
    """Tests for transcribe global daily rate limit."""

    def test_global_limit(self, rate_limited_client, rate_limit_settings, test_engine):
        """Global limit should count all requests regardless of session/IP."""
        from sqlalchemy.orm import sessionmaker

        mock_transcribe_success(rate_limit_settings)

        # Add entries from various sessions/IPs
        TestingSessionLocal = sessionmaker(bind=test_engine)
        db = TestingSessionLocal()

        for i in range(5):  # Global limit is 5
            entry = RateLimitEntry(
                session_id=f"session-{i}",
                ip_address=f"192.168.1.{i}",
                action="transcribe",
                created_at=datetime.utcnow() - timedelta(hours=2),
            )
            db.add(entry)
        db.commit()
        db.close()

        # Global count is 5 (at limit)
        response = do_transcribe(rate_limited_client)
        assert response.status_code == 429

        data = response.json()
        assert data["limit_type"] == "global_day"
        assert "service is busy" in data["message"]


# =============================================================================
# Analyze Endpoint Tests (LLM Limits - 10x)
# =============================================================================


class TestRateLimitAnalyze:
    """Tests for analyze endpoint with LLM limits (10x transcribe)."""

    def test_analyze_has_higher_limits(self, rate_limited_client, rate_limit_settings, test_engine):
        """Analyze endpoint should have 10x higher limits than transcribe."""
        from sqlalchemy.orm import sessionmaker

        mock_analyze_success(rate_limit_settings)
        mock_transcribe_success(rate_limit_settings)

        # Make requests up to transcribe daily limit (3)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)

        # Transcribe should now be blocked
        response = do_transcribe(rate_limited_client)
        assert response.status_code == 429

        # But analyze should still work (different action, different limits)
        response = do_analyze(rate_limited_client)
        assert response.status_code == 200

    def test_analyze_blocks_at_llm_limit(self, rate_limited_client, rate_limit_settings, test_engine):
        """Analyze should block when LLM limits are reached."""
        from sqlalchemy.orm import sessionmaker

        mock_analyze_success(rate_limit_settings)

        # Get session established
        do_analyze(rate_limited_client)

        # Get session_id
        TestingSessionLocal = sessionmaker(bind=test_engine)
        db = TestingSessionLocal()
        entries = db.query(RateLimitEntry).filter_by(action="analyze").all()
        session_id = entries[0].session_id
        ip_address = entries[0].ip_address

        # Add entries up to LLM daily limit (30 for test)
        for _ in range(29):  # Already have 1
            entry = RateLimitEntry(
                session_id=session_id,
                ip_address=ip_address,
                action="analyze",
            )
            db.add(entry)
        db.commit()
        db.close()

        # Should now be blocked
        response = do_analyze(rate_limited_client)
        assert response.status_code == 429


# =============================================================================
# Response Headers Tests
# =============================================================================


class TestRateLimitHeaders:
    """Tests for rate limit headers."""

    def test_success_response_includes_headers(self, rate_limited_client, rate_limit_settings):
        """Successful responses should include rate limit headers."""
        mock_transcribe_success(rate_limit_settings)

        response = do_transcribe(rate_limited_client)

        assert response.status_code == 202
        assert "X-RateLimit-Limit-Day" in response.headers
        assert "X-RateLimit-Remaining-Day" in response.headers
        assert "X-RateLimit-Reset" in response.headers

        # Check values
        assert response.headers["X-RateLimit-Limit-Day"] == "3"
        assert response.headers["X-RateLimit-Remaining-Day"] == "2"  # Used 1 of 3

    def test_429_response_includes_headers(self, rate_limited_client, rate_limit_settings):
        """429 responses should include rate limit headers and Retry-After."""
        mock_transcribe_success(rate_limit_settings)

        # Exhaust daily limit (3)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)

        response = do_transcribe(rate_limited_client)

        assert response.status_code == 429
        assert "X-RateLimit-Limit-Day" in response.headers
        assert "X-RateLimit-Remaining-Day" in response.headers
        assert "Retry-After" in response.headers

        assert response.headers["X-RateLimit-Remaining-Day"] == "0"

    def test_retry_after_is_positive(self, rate_limited_client, rate_limit_settings):
        """Retry-After header should be a positive integer."""
        mock_transcribe_success(rate_limit_settings)

        # Exhaust daily limit (3)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)

        response = do_transcribe(rate_limited_client)

        retry_after = int(response.headers["Retry-After"])
        assert retry_after > 0


# =============================================================================
# Response Format Tests
# =============================================================================


class TestRateLimitResponseFormat:
    """Tests for 429 response body format."""

    def test_429_body_structure(self, rate_limited_client, rate_limit_settings):
        """429 response body should have correct structure."""
        mock_transcribe_success(rate_limit_settings)

        # Exhaust daily limit (3)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)
        do_transcribe(rate_limited_client)

        response = do_transcribe(rate_limited_client)
        data = response.json()

        # Check required fields
        assert "error" in data
        assert "message" in data
        assert "limit_type" in data
        assert "retry_after" in data
        assert "limits" in data

        # Check error value
        assert data["error"] == "rate_limit_exceeded"

        # Check limits structure
        assert "day" in data["limits"]
        assert "ip_day" in data["limits"]
        assert "global_day" in data["limits"]

        # Check limit info structure
        day_info = data["limits"]["day"]
        assert "limit" in day_info
        assert "remaining" in day_info
        assert "reset" in day_info


