#!/usr/bin/env python3
"""
Generate Demo Content for Eversaid

This script processes an audio file through the Core API to generate
pre-loaded demo content (JSON + audio) for the Eversaid demo page.

The Core API is a complete audio transcription service that handles:
1. User authentication (JWT-based)
2. Audio upload and transcription (using Whisper via Groq)
3. Speaker diarization (identifying who said what)
4. LLM-powered text cleanup (fixing filler words, punctuation)
5. Content analysis (summaries, action items, etc.)

This script demonstrates the complete workflow from raw audio to
structured, analyzed content.

Usage:
    python scripts/generate_demo_content.py \\
        --audio /path/to/recording.mp3 \\
        --locale en \\
        --core-api-url http://localhost:8000

Output:
    - data/demo/{locale}.json  - Structured transcription + analysis
    - data/demo/{locale}.mp3   - Copy of audio file

Requirements:
    - requests (pip install requests)
    - A running Core API instance
"""

import argparse
import json
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


# =============================================================================
# Configuration
# =============================================================================

# Session file stores auth tokens between runs
SESSION_FILE = ".demo-session.json"

# Demo user credentials (created automatically if needed)
DEMO_EMAIL = "demo-content-generator@eversaid.example"
DEMO_PASSWORD = "demo-content-secure-password-2026"

# Polling configuration
POLL_INTERVAL_SECONDS = 2
POLL_TIMEOUT_SECONDS = 300  # 5 minutes max wait


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class Session:
    """Holds authentication tokens for API requests."""

    access_token: str
    refresh_token: str

    def to_dict(self) -> dict:
        return {"access_token": self.access_token, "refresh_token": self.refresh_token}

    @classmethod
    def from_dict(cls, data: dict) -> "Session":
        return cls(
            access_token=data["access_token"], refresh_token=data["refresh_token"]
        )


# =============================================================================
# Core API Client
# =============================================================================


class CoreAPIClient:
    """
    Client for interacting with the Eversaid Core API.

    The Core API is a REST service that handles the complete audio processing
    pipeline: upload -> transcribe -> cleanup -> analyze.

    All endpoints (except auth) require Bearer token authentication.
    """

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session: Session | None = None

    def _headers(self) -> dict[str, str]:
        """Build authorization headers for authenticated requests."""
        if not self.session:
            raise RuntimeError("Not authenticated. Call login() first.")
        return {"Authorization": f"Bearer {self.session.access_token}"}

    # -------------------------------------------------------------------------
    # Authentication
    # -------------------------------------------------------------------------

    def register(self, email: str, password: str) -> dict[str, Any]:
        """
        Register a new user account.

        POST /api/v1/auth/register
        {
            "email": "user@example.com",
            "password": "secure-password"
        }

        Returns user object on success. Raises on duplicate email.
        """
        print(f"  Registering user: {email}")
        response = requests.post(
            f"{self.base_url}/api/v1/auth/register",
            json={"email": email, "password": password},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def login(self, email: str, password: str) -> Session:
        """
        Authenticate and get access tokens.

        POST /api/v1/auth/login
        {
            "email": "user@example.com",
            "password": "secure-password"
        }

        Returns JWT tokens:
        - access_token: Short-lived token for API requests (typically 1 hour)
        - refresh_token: Long-lived token for getting new access tokens

        The access token is included in all subsequent requests as:
        Authorization: Bearer <access_token>
        """
        print(f"  Logging in as: {email}")
        response = requests.post(
            f"{self.base_url}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        self.session = Session(
            access_token=data["access_token"], refresh_token=data["refresh_token"]
        )
        return self.session

    # -------------------------------------------------------------------------
    # Upload & Transcribe
    # -------------------------------------------------------------------------

    def upload_transcribe_cleanup(
        self,
        audio_path: Path,
        language: str = "en",
        enable_diarization: bool = True,
        speaker_count: int = 2,
    ) -> dict[str, Any]:
        """
        Upload audio and trigger transcription + cleanup in one call.

        POST /api/v1/upload-transcribe-cleanup
        Content-Type: multipart/form-data

        This is the "happy path" endpoint that combines:
        1. Audio file upload
        2. Transcription with Whisper (via Groq)
        3. Speaker diarization (if enabled)
        4. LLM text cleanup

        Parameters:
        - file: The audio file (MP3, WAV, M4A, etc.)
        - language: ISO 639-1 code ('en', 'sl', 'de', etc.)
        - transcription_provider: 'groq' (fast) or 'elevenlabs' (more accurate)
        - enable_diarization: True to identify different speakers
        - speaker_count: Expected number of speakers (helps diarization)

        Returns IDs for polling:
        - entry_id: The voice entry (audio file record)
        - transcription_id: The transcription job
        - cleanup_id: The cleanup job (LLM text improvement)
        """
        print(f"  Uploading: {audio_path.name}")
        print(f"  Language: {language}")
        print(f"  Diarization: {enable_diarization} ({speaker_count} speakers)")

        with open(audio_path, "rb") as f:
            response = requests.post(
                f"{self.base_url}/api/v1/upload-transcribe-cleanup",
                headers=self._headers(),
                files={"file": (audio_path.name, f, "audio/mpeg")},
                data={
                    "entry_type": "journal",
                    "language": language,
                    "enable_diarization": str(enable_diarization).lower(),
                    "speaker_count": str(speaker_count),
                },
                timeout=60,
            )
        response.raise_for_status()
        return response.json()

    # -------------------------------------------------------------------------
    # Polling for Completion
    # -------------------------------------------------------------------------

    def get_transcription(self, transcription_id: str) -> dict[str, Any]:
        """
        Get transcription status and results.

        GET /api/v1/transcriptions/{id}

        Status progression: pending -> processing -> completed/failed

        When completed, includes:
        - segments: Array of {id, start, end, text, speaker}
        - words: Word-level timing (if available from provider)
        - transcribed_text: Full text concatenated
        """
        response = requests.get(
            f"{self.base_url}/api/v1/transcriptions/{transcription_id}",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_cleanup(self, cleanup_id: str) -> dict[str, Any]:
        """
        Get cleanup status and results.

        GET /api/v1/cleaned-entries/{id}

        The cleanup process uses an LLM (Llama 3.3 70B) to:
        - Remove filler words (um, uh, like, you know)
        - Fix punctuation and capitalization
        - Correct obvious transcription errors
        - Preserve speaker attributions

        When completed, includes:
        - cleaned_segments: Array of {speaker, text, original_text}
        - cleaned_text: Full cleaned text (for single-speaker)
        """
        response = requests.get(
            f"{self.base_url}/api/v1/cleaned-entries/{cleanup_id}",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def poll_until_complete(
        self,
        get_func,
        resource_id: str,
        resource_name: str,
    ) -> dict[str, Any]:
        """
        Poll a resource until it reaches completed or failed status.

        The Core API processes audio asynchronously. After triggering a job,
        you must poll until it completes. Typical timing:
        - Transcription: 10-60 seconds depending on audio length
        - Cleanup: 5-15 seconds
        - Analysis: 5-15 seconds per profile
        """
        start_time = time.time()
        last_status = None

        while True:
            result = get_func(resource_id)
            status = result.get("status")

            # Log status changes
            if status != last_status:
                print(f"    {resource_name} status: {status}")
                last_status = status

            if status == "completed":
                return result
            elif status == "failed":
                error = result.get("error_message", "Unknown error")
                raise RuntimeError(f"{resource_name} failed: {error}")

            # Check timeout
            elapsed = time.time() - start_time
            if elapsed > POLL_TIMEOUT_SECONDS:
                raise TimeoutError(
                    f"{resource_name} timeout after {POLL_TIMEOUT_SECONDS}s"
                )

            time.sleep(POLL_INTERVAL_SECONDS)

    # -------------------------------------------------------------------------
    # Analysis
    # -------------------------------------------------------------------------

    def get_analysis_profiles(self) -> list[dict[str, Any]]:
        """
        Get available analysis profiles.

        GET /api/v1/analysis-profiles

        Analysis profiles define what the LLM should extract from the
        transcript. Each profile has:
        - profile_id: Unique identifier (e.g., 'generic-summary')
        - label: Human-readable name
        - description: What the analysis produces
        """
        response = requests.get(
            f"{self.base_url}/api/v1/analysis-profiles",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        # Handle both {profiles: [...]} and direct [...] response formats
        return data.get("profiles", data) if isinstance(data, dict) else data

    def trigger_analysis(self, cleanup_id: str, profile_id: str) -> dict[str, Any]:
        """
        Trigger analysis for a specific profile.

        POST /api/v1/cleaned-entries/{cleanup_id}/analyze
        {"profile_id": "generic-summary"}

        Returns an analysis job with ID for polling.
        """
        response = requests.post(
            f"{self.base_url}/api/v1/cleaned-entries/{cleanup_id}/analyze",
            headers=self._headers(),
            json={"profile_id": profile_id},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_analysis(self, analysis_id: str) -> dict[str, Any]:
        """
        Get analysis status and result.

        GET /api/v1/analyses/{id}

        When completed, includes:
        - result: The analysis output (structure depends on profile)
        - profile_id: Which profile was used
        - processing_time_seconds: How long it took
        """
        response = requests.get(
            f"{self.base_url}/api/v1/analyses/{analysis_id}",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()


# =============================================================================
# Data Transformation
# =============================================================================


def parse_speaker_number(speaker: str | int | None) -> int | None:
    """
    Extract speaker number from Core API format.

    Core API may return speakers as:
    - "SPEAKER_00", "SPEAKER_01" (string format)
    - 0, 1 (integer format)
    - None (no speaker info)

    The frontend expects 0-indexed integers.

    Examples:
        "SPEAKER_00" -> 0
        "SPEAKER_01" -> 1
        0 -> 0
        1 -> 1
        None -> None
    """
    if speaker is None:
        return None
    if isinstance(speaker, int):
        return speaker
    match = re.search(r"SPEAKER_(\d+)", speaker)
    return int(match.group(1)) if match else None


def distribute_words_to_segments(
    segments: list[dict], words: list[dict] | None
) -> list[list[dict]]:
    """
    Distribute flat word array to segments by time range.

    The Core API returns words as a flat array with timing info.
    Each word needs to be assigned to the segment it falls within.

    This enables word-level highlighting during audio playback.
    """
    if not words:
        return [[] for _ in segments]

    segment_words: list[list[dict]] = [[] for _ in segments]

    for word in words:
        word_start = word.get("start", 0)
        # Find which segment this word belongs to
        for i, seg in enumerate(segments):
            if seg["start"] <= word_start < seg["end"]:
                segment_words[i].append(word)
                break

    return segment_words


def transform_transcription_segments(
    transcription: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Transform Core API transcription segments to demo format.

    Core API format:
        {
            "id": 0,
            "start": 0.0,
            "end": 5.2,
            "text": "Hello world",
            "speaker": "SPEAKER_00"
        }

    Demo format:
        {
            "id": "seg-0",
            "start": 0.0,
            "end": 5.2,
            "text": "Hello world",
            "speaker": 0,
            "words": [...]
        }
    """
    segments = transcription.get("segments", [])
    words = transcription.get("words", [])
    segment_words = distribute_words_to_segments(segments, words)

    result = []
    for i, seg in enumerate(segments):
        transformed = {
            "id": f"seg-{i}",
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"],
            "speaker": parse_speaker_number(seg.get("speaker")),
        }

        # Add words if available (enables playback highlighting)
        if segment_words[i]:
            transformed["words"] = [
                {
                    "text": w["text"],
                    "start": w["start"],
                    "end": w["end"],
                    "type": w.get("type", "word"),
                    "speaker_id": parse_speaker_number(w.get("speaker")),
                }
                for w in segment_words[i]
            ]

        result.append(transformed)

    return result


def transform_cleaned_segments(
    cleanup: dict[str, Any], raw_segments: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Transform Core API cleaned segments to demo format.

    The cleanup response contains cleaned text for each segment.
    We need to:
    1. Match cleaned segments to raw segments (by order/speaker)
    2. Add timing info from raw segments
    3. Add raw_segment_id for linking

    Core API format:
        {
            "speaker": "SPEAKER_00",
            "text": "Hello, world.",
            "original_text": "hello uh world"
        }

    Demo format:
        {
            "id": "clean-0",
            "start": 0.0,
            "end": 5.2,
            "text": "Hello, world.",
            "speaker": 0,
            "raw_segment_id": "seg-0"
        }
    """
    cleaned_segments = cleanup.get("cleaned_segments", [])

    # If no cleaned segments, create from cleaned_text (single-speaker)
    if not cleaned_segments and cleanup.get("cleaned_text"):
        # Single-speaker: use the raw segments structure with cleaned text
        # This is a simplification - ideally we'd have segment-level cleanup
        return [
            {
                "id": f"clean-{i}",
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],  # Use raw text as we don't have per-segment cleanup
                "speaker": seg.get("speaker"),
                "raw_segment_id": seg["id"],
            }
            for i, seg in enumerate(raw_segments)
        ]

    # Multi-speaker: match cleaned to raw by position
    result = []
    for i, cleaned in enumerate(cleaned_segments):
        # Get corresponding raw segment (same index)
        raw_seg = raw_segments[i] if i < len(raw_segments) else None

        transformed = {
            "id": f"clean-{i}",
            "start": raw_seg["start"] if raw_seg else 0.0,
            "end": raw_seg["end"] if raw_seg else 0.0,
            "text": cleaned["text"],
            "speaker": parse_speaker_number(cleaned.get("speaker")),
            "raw_segment_id": raw_seg["id"] if raw_seg else None,
        }
        result.append(transformed)

    return result


def transform_analyses(analyses_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Transform analysis results to demo format.

    Core API includes many fields; we only need:
    - profileId: Which analysis profile was used
    - status: Always "completed" for demo
    - result: The analysis output
    """
    return [
        {
            "profileId": analysis["profile_id"],
            "status": "completed",
            "result": analysis.get("result", {}),
        }
        for analysis in analyses_results
    ]


def count_unique_speakers(segments: list[dict]) -> int:
    """Count unique speakers in segments."""
    speakers = {seg.get("speaker") for seg in segments if seg.get("speaker") is not None}
    return len(speakers) if speakers else 1


# =============================================================================
# Session Management
# =============================================================================


def load_session(session_file: Path) -> Session | None:
    """Load saved session from file."""
    if not session_file.exists():
        return None
    try:
        with open(session_file) as f:
            data = json.load(f)
        return Session.from_dict(data)
    except (json.JSONDecodeError, KeyError):
        return None


def save_session(session: Session, session_file: Path) -> None:
    """Save session to file for reuse."""
    with open(session_file, "w") as f:
        json.dump(session.to_dict(), f, indent=2)


# =============================================================================
# Main Workflow
# =============================================================================


def authenticate(client: CoreAPIClient, session_file: Path) -> None:
    """
    Authenticate with Core API, registering if needed.

    This demonstrates the authentication flow:
    1. Try to use saved session
    2. If no session, try to login
    3. If login fails (user doesn't exist), register first
    """
    print("\n1. AUTHENTICATION")
    print("-" * 40)

    # Try loading existing session
    existing_session = load_session(session_file)
    if existing_session:
        print("  Found existing session, verifying...")
        client.session = existing_session
        try:
            # Test if session is still valid
            client.get_analysis_profiles()
            print("  Session valid!")
            return
        except requests.HTTPError:
            print("  Session expired, re-authenticating...")

    # Try to login
    try:
        session = client.login(DEMO_EMAIL, DEMO_PASSWORD)
    except requests.HTTPError as e:
        if e.response.status_code == 401:
            # User doesn't exist, register first
            print("  User not found, registering...")
            client.register(DEMO_EMAIL, DEMO_PASSWORD)
            session = client.login(DEMO_EMAIL, DEMO_PASSWORD)
        else:
            raise

    save_session(session, session_file)
    print("  Authenticated successfully!")


def process_audio(
    client: CoreAPIClient, audio_path: Path, language: str, speaker_count: int
) -> tuple[dict, dict, float]:
    """
    Process audio through transcription and cleanup.

    Returns:
        (transcription, cleanup, duration_seconds)
    """
    print("\n2. UPLOAD & TRANSCRIBE")
    print("-" * 40)

    # Start the combined upload/transcribe/cleanup process
    result = client.upload_transcribe_cleanup(
        audio_path=audio_path,
        language=language,
        enable_diarization=True,
        speaker_count=speaker_count,
    )

    print(f"  Entry ID: {result['entry_id']}")
    print(f"  Transcription ID: {result['transcription_id']}")
    print(f"  Cleanup ID: {result['cleanup_id']}")

    # Get duration from response
    duration = result.get("duration_seconds", 0)

    # Poll for transcription completion
    print("\n3. POLL TRANSCRIPTION")
    print("-" * 40)
    transcription = client.poll_until_complete(
        client.get_transcription, result["transcription_id"], "Transcription"
    )
    segment_count = len(transcription.get("segments", []))
    print(f"  Completed: {segment_count} segments")

    # Poll for cleanup completion
    print("\n4. POLL CLEANUP")
    print("-" * 40)
    cleanup = client.poll_until_complete(
        client.get_cleanup, result["cleanup_id"], "Cleanup"
    )
    cleaned_count = len(cleanup.get("cleaned_segments", []))
    print(f"  Completed: {cleaned_count} cleaned segments")

    return transcription, cleanup, duration


def run_analyses(client: CoreAPIClient, cleanup_id: str) -> list[dict]:
    """
    Run all available analysis profiles on the cleaned text.

    This demonstrates the analysis workflow:
    1. Get available profiles
    2. Trigger each profile
    3. Poll until complete
    4. Collect results
    """
    print("\n5. RUN ANALYSES")
    print("-" * 40)

    profiles = client.get_analysis_profiles()
    print(f"  Available profiles: {len(profiles)}")

    results = []
    for profile in profiles:
        # API returns 'id' for profile identifier
        profile_id = profile.get("id") or profile.get("profile_id")
        label = profile.get("label", profile_id)
        print(f"\n  Running: {label}")

        # Trigger analysis
        job = client.trigger_analysis(cleanup_id, profile_id)
        analysis_id = job["id"]

        # Poll until complete
        result = client.poll_until_complete(
            client.get_analysis, analysis_id, f"Analysis ({label})"
        )
        results.append(result)
        print(f"    Completed!")

    return results


def build_demo_json(
    locale: str,
    audio_filename: str,
    duration_seconds: float,
    transcription: dict,
    cleanup: dict,
    analyses: list[dict],
) -> dict[str, Any]:
    """
    Build the final demo JSON structure.

    This combines all processed data into the format expected by
    the Eversaid frontend demo page.
    """
    print("\n6. TRANSFORM & SAVE")
    print("-" * 40)

    # Transform segments
    raw_segments = transform_transcription_segments(transcription)
    cleaned_segments = transform_cleaned_segments(cleanup, raw_segments)
    demo_analyses = transform_analyses(analyses)

    # Count speakers
    speaker_count = count_unique_speakers(raw_segments)

    demo_data = {
        "locale": locale,
        "version": "1.0.0",
        "filename": f"demo-{locale}.mp3",
        "durationSeconds": duration_seconds,
        "speakerCount": speaker_count,
        "rawSegments": raw_segments,
        "cleanedSegments": cleaned_segments,
        "analyses": demo_analyses,
    }

    print(f"  Raw segments: {len(raw_segments)}")
    print(f"  Cleaned segments: {len(cleaned_segments)}")
    print(f"  Analyses: {len(demo_analyses)}")
    print(f"  Speakers: {speaker_count}")
    print(f"  Duration: {duration_seconds:.1f}s")

    return demo_data


def main():
    parser = argparse.ArgumentParser(
        description="Generate demo content by processing audio through Core API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python scripts/generate_demo_content.py --audio recording.mp3 --locale en
    python scripts/generate_demo_content.py --audio podcast.mp3 --locale sl --speakers 2

The script will:
1. Authenticate with Core API (register user if needed)
2. Upload and transcribe the audio
3. Run LLM cleanup on the transcript
4. Run all available analysis profiles
5. Save structured JSON to data/demo/{locale}.json
6. Copy audio to data/demo/{locale}.mp3
        """,
    )
    parser.add_argument(
        "--audio", type=Path, required=True, help="Path to audio file (MP3, WAV, M4A)"
    )
    parser.add_argument(
        "--locale",
        type=str,
        required=True,
        choices=["en", "sl"],
        help="Language code for transcription",
    )
    parser.add_argument(
        "--core-api-url",
        type=str,
        default="http://localhost:8000",
        help="Core API base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--speakers",
        type=int,
        default=2,
        help="Expected number of speakers (default: 2)",
    )

    args = parser.parse_args()

    # Validate audio file exists
    if not args.audio.exists():
        print(f"Error: Audio file not found: {args.audio}")
        sys.exit(1)

    # Setup paths
    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent
    output_dir = backend_dir / "data" / "demo"
    session_file = script_dir / SESSION_FILE

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("EVERSAID DEMO CONTENT GENERATOR")
    print("=" * 60)
    print(f"Audio: {args.audio}")
    print(f"Locale: {args.locale}")
    print(f"Speakers: {args.speakers}")
    print(f"Core API: {args.core_api_url}")
    print(f"Output: {output_dir}")

    # Initialize client
    client = CoreAPIClient(args.core_api_url)

    try:
        # Step 1: Authenticate
        authenticate(client, session_file)

        # Step 2-4: Process audio
        transcription, cleanup, duration = process_audio(
            client, args.audio, args.locale, args.speakers
        )

        # Step 5: Run analyses
        cleanup_id = cleanup["id"]
        analyses = run_analyses(client, cleanup_id)

        # Step 6: Build and save JSON
        demo_data = build_demo_json(
            locale=args.locale,
            audio_filename=args.audio.name,
            duration_seconds=duration,
            transcription=transcription,
            cleanup=cleanup,
            analyses=analyses,
        )

        json_path = output_dir / f"{args.locale}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(demo_data, f, indent=2, ensure_ascii=False)
        print(f"  Saved: {json_path}")

        # Step 7: Copy audio
        print("\n7. COPY AUDIO")
        print("-" * 40)
        audio_dest = output_dir / f"{args.locale}.mp3"
        shutil.copy2(args.audio, audio_dest)
        print(f"  Copied: {audio_dest}")

        print("\n" + "=" * 60)
        print("DEMO CONTENT GENERATION COMPLETE!")
        print("=" * 60)
        print(f"\nOutput files:")
        print(f"  - {json_path}")
        print(f"  - {audio_dest}")
        print(f"\nTo use in Eversaid:")
        print(f"  1. Mount data/demo/ directory in Docker")
        print(f"  2. Start frontend and navigate to demo page")
        print(f"  3. Demo entry will appear in history sidebar")

    except requests.HTTPError as e:
        print(f"\nAPI Error: {e}")
        if e.response is not None:
            try:
                detail = e.response.json().get("detail", e.response.text)
                print(f"Detail: {detail}")
            except json.JSONDecodeError:
                print(f"Response: {e.response.text}")
        sys.exit(1)
    except TimeoutError as e:
        print(f"\nTimeout: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
