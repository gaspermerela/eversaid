"""Tests for demo content endpoints."""

import json
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings


# Sample demo data in RAW format (as stored by generate_demo_content.py)
# This mimics what Core API returns
SAMPLE_RAW_DEMO_DATA = {
    "locale": "en",
    "transcription": {
        "id": "trans-123",
        "status": "completed",
        "duration_seconds": 180.5,
        "segments": [
            {
                "start": 0.0,
                "end": 10.5,
                "text": "Hello, this is a demo transcription.",
                "speaker": 0,
            },
            {
                "start": 10.5,
                "end": 20.0,
                "text": "Yes, it shows how the app works.",
                "speaker": 1,
            },
        ],
        "words": [
            {"text": "Hello,", "start": 0.0, "end": 0.5, "type": "word", "speaker": 0},
            {"text": "this", "start": 0.6, "end": 0.8, "type": "word", "speaker": 0},
            {"text": "is", "start": 0.9, "end": 1.0, "type": "word", "speaker": 0},
            {"text": "a", "start": 1.1, "end": 1.2, "type": "word", "speaker": 0},
            {"text": "demo", "start": 1.3, "end": 1.6, "type": "word", "speaker": 0},
            {"text": "transcription.", "start": 1.7, "end": 2.5, "type": "word", "speaker": 0},
            {"text": "Yes,", "start": 10.5, "end": 10.8, "type": "word", "speaker": 1},
            {"text": "it", "start": 10.9, "end": 11.0, "type": "word", "speaker": 1},
            {"text": "shows", "start": 11.1, "end": 11.4, "type": "word", "speaker": 1},
        ],
    },
    "cleanup": {
        "id": "cleanup-123",
        "status": "completed",
        "cleaned_segments": [
            {
                "text": "Hello, this is a demo transcription.",
                "speaker": 0,
            },
            {
                "text": "Yes, it shows how the app works.",
                "speaker": 1,
            },
        ],
    },
    "analyses": [
        {
            "id": "analysis-123",
            "profile_id": "generic-summary",
            "status": "completed",
            "result": {
                "summary": "A demo conversation about the transcription app.",
                "topics": ["demo", "transcription"],
            },
        }
    ],
}


@pytest.fixture
def demo_data_dir():
    """Create a temporary directory with demo data files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        demo_path = Path(tmpdir)

        # Write English demo JSON (raw format)
        with open(demo_path / "en.json", "w") as f:
            json.dump(SAMPLE_RAW_DEMO_DATA, f)

        # Write Slovenian demo JSON (same structure, different locale)
        sl_data = {**SAMPLE_RAW_DEMO_DATA, "locale": "sl"}
        with open(demo_path / "sl.json", "w") as f:
            json.dump(sl_data, f)

        # Write dummy audio files
        with open(demo_path / "en.mp3", "wb") as f:
            f.write(b"\xff\xfb\x90\x00" + b"\x00" * 100)

        with open(demo_path / "sl.mp3", "wb") as f:
            f.write(b"\xff\xfb\x90\x00" + b"\x00" * 100)

        yield demo_path


@pytest.fixture
def demo_client(demo_data_dir, test_engine):
    """Create a test client with demo data configured."""
    from app.main import app as fastapi_app
    from app.config import get_settings
    from app.database import get_db
    from sqlalchemy.orm import sessionmaker, Session
    from typing import Generator
    import app.main as main_module

    demo_settings = Settings(
        CORE_API_URL="http://core-api:8000",
        DEMO_DATA_PATH=str(demo_data_dir),
        DATABASE_URL="sqlite://",
    )

    TestingSessionLocal = sessionmaker(bind=test_engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    get_settings.cache_clear()
    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.dependency_overrides[get_settings] = lambda: demo_settings

    original_get_settings = main_module.get_settings
    main_module.get_settings = lambda: demo_settings

    with TestClient(fastapi_app, raise_server_exceptions=False) as test_client:
        yield test_client

    main_module.get_settings = original_get_settings
    fastapi_app.dependency_overrides.clear()
    get_settings.cache_clear()


class TestGetDemoEntry:
    """Tests for GET /api/demo/entry endpoint."""

    def test_get_demo_entry_english(self, demo_client: TestClient):
        """Should return English demo data in EntryDetails format."""
        response = demo_client.get("/api/demo/entry?locale=en")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "demo-en"
        assert data["original_filename"] == "demo-en.mp3"
        assert data["duration_seconds"] == 180.5
        assert data["entry_type"] == "demo"
        assert len(data["primary_transcription"]["segments"]) == 2
        assert len(data["cleanup"]["cleaned_segments"]) == 2
        assert len(data["analyses"]) == 1

    def test_get_demo_entry_slovenian(self, demo_client: TestClient):
        """Should return Slovenian demo data."""
        response = demo_client.get("/api/demo/entry?locale=sl")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "demo-sl"

    def test_get_demo_entry_default_locale(self, demo_client: TestClient):
        """Should default to English if no locale specified."""
        response = demo_client.get("/api/demo/entry")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "demo-en"

    def test_get_demo_entry_invalid_locale(self, demo_client: TestClient):
        """Should return 400 for invalid locale."""
        response = demo_client.get("/api/demo/entry?locale=fr")

        assert response.status_code == 400
        assert "Invalid locale" in response.json()["detail"]

    def test_get_demo_entry_includes_word_timing(self, demo_client: TestClient):
        """Should include word-level timing data in transcription segments."""
        response = demo_client.get("/api/demo/entry?locale=en")

        assert response.status_code == 200
        data = response.json()
        first_segment = data["primary_transcription"]["segments"][0]
        assert "words" in first_segment
        assert len(first_segment["words"]) == 6
        assert first_segment["words"][0]["text"] == "Hello,"
        assert first_segment["words"][0]["start"] == 0.0

    def test_get_demo_entry_cleaned_segments_have_raw_id(self, demo_client: TestClient):
        """Should include raw_segment_id in cleaned segments."""
        response = demo_client.get("/api/demo/entry?locale=en")

        assert response.status_code == 200
        data = response.json()
        first_cleaned = data["cleanup"]["cleaned_segments"][0]
        assert first_cleaned["raw_segment_id"] == "seg-0"

    def test_get_demo_entry_segments_have_generated_ids(self, demo_client: TestClient):
        """Should generate segment IDs (seg-0, seg-1, etc.)."""
        response = demo_client.get("/api/demo/entry?locale=en")

        assert response.status_code == 200
        data = response.json()
        assert data["primary_transcription"]["segments"][0]["id"] == "seg-0"
        assert data["primary_transcription"]["segments"][1]["id"] == "seg-1"
        assert data["cleanup"]["cleaned_segments"][0]["id"] == "clean-0"

    def test_get_demo_entry_not_found(self, client: TestClient):
        """Should return 404 when demo files don't exist."""
        response = client.get("/api/demo/entry?locale=en")

        assert response.status_code == 404
        assert "Demo data not available" in response.json()["detail"]


class TestGetDemoAudio:
    """Tests for GET /api/demo/audio/{locale} endpoint."""

    def test_get_demo_audio_english(self, demo_client: TestClient):
        """Should stream English audio file."""
        response = demo_client.get("/api/demo/audio/en")

        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/mpeg"
        assert 'filename="demo-en.mp3"' in response.headers.get(
            "content-disposition", ""
        )

    def test_get_demo_audio_slovenian(self, demo_client: TestClient):
        """Should stream Slovenian audio file."""
        response = demo_client.get("/api/demo/audio/sl")

        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/mpeg"

    def test_get_demo_audio_invalid_locale(self, demo_client: TestClient):
        """Should return 400 for invalid locale."""
        response = demo_client.get("/api/demo/audio/fr")

        assert response.status_code == 400
        assert "Invalid locale" in response.json()["detail"]

    def test_get_demo_audio_not_found(self, client: TestClient):
        """Should return 404 when audio file doesn't exist."""
        response = client.get("/api/demo/audio/en")

        assert response.status_code == 404
        assert "Demo audio not available" in response.json()["detail"]


class TestDemoDataValidation:
    """Tests for demo data schema validation."""

    def test_missing_required_fields(self, demo_data_dir):
        """Should handle missing required fields gracefully."""
        invalid_data = {"locale": "en"}  # Missing transcription, cleanup, analyses
        with open(demo_data_dir / "en.json", "w") as f:
            json.dump(invalid_data, f)

        settings = Settings(
            CORE_API_URL="http://core-api:8000",
            DEMO_DATA_PATH=str(demo_data_dir),
            DATABASE_URL="sqlite://",
        )

        from app.main import app as fastapi_app
        from app.config import get_settings

        fastapi_app.dependency_overrides[get_settings] = lambda: settings

        with TestClient(fastapi_app, raise_server_exceptions=False) as test_client:
            response = test_client.get("/api/demo/entry?locale=en")
            assert response.status_code == 500

        fastapi_app.dependency_overrides.clear()

    def test_invalid_json(self, demo_data_dir):
        """Should handle corrupted JSON files."""
        with open(demo_data_dir / "en.json", "w") as f:
            f.write("{ invalid json }")

        settings = Settings(
            CORE_API_URL="http://core-api:8000",
            DEMO_DATA_PATH=str(demo_data_dir),
            DATABASE_URL="sqlite://",
        )

        from app.main import app as fastapi_app
        from app.config import get_settings

        fastapi_app.dependency_overrides[get_settings] = lambda: settings

        with TestClient(fastapi_app, raise_server_exceptions=False) as test_client:
            response = test_client.get("/api/demo/entry?locale=en")
            assert response.status_code == 500
            assert "corrupted" in response.json()["detail"]

        fastapi_app.dependency_overrides.clear()
