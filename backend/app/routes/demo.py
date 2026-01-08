"""Demo content endpoints for serving pre-loaded demo entries.

These endpoints serve static demo content (JSON + audio) from the filesystem.
Demo files are NOT committed to the repository - they are mounted at runtime
via Docker volumes or placed manually in the DEMO_DATA_PATH directory.

Expected file structure in DEMO_DATA_PATH:
    en.json  - English demo transcription/analysis data
    sl.json  - Slovenian demo transcription/analysis data
    en.mp3   - English demo audio file
    sl.mp3   - Slovenian demo audio file

To create demo data:
    1. Transcribe audio with Core API
    2. Copy transcription.segments to rawSegments (includes words for highlighting)
    3. Copy cleanup.cleaned_segments to cleanedSegments
    4. Add analyses results

The JSON files should match the DemoEntryData schema expected by the frontend.
"""

import json
import logging
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import Settings, get_settings


router = APIRouter(prefix="/api/demo", tags=["demo"])
logger = logging.getLogger(__name__)


# =============================================================================
# Response Models
# =============================================================================


class TranscriptionWord(BaseModel):
    """Word-level timing data from transcription API."""

    text: str
    start: float
    end: float
    type: str = "word"  # 'word' | 'spacing' | 'audio_event'
    speaker_id: int | None = None


class RawSegment(BaseModel):
    """A raw transcription segment (matches ApiSegment on frontend).

    Raw segments come directly from the transcription and include
    word-level timing for playback highlighting.
    """

    id: str
    start: float
    end: float
    text: str
    speaker: int | None = None
    words: list[TranscriptionWord] | None = None


class CleanedSegment(BaseModel):
    """A cleaned transcription segment (matches CleanedSegment on frontend).

    Cleaned segments contain the LLM-cleaned text and may have
    spellcheck information.
    """

    id: str
    start: float
    end: float
    text: str
    speaker: int | None = None
    raw_segment_id: str | None = None
    spellcheck_errors: list[dict[str, Any]] | None = None


class DemoAnalysis(BaseModel):
    """Pre-computed analysis result."""

    profileId: str
    status: str
    result: dict[str, Any]


class DemoEntryResponse(BaseModel):
    """Full demo entry data returned to frontend.

    This schema matches what the frontend expects for displaying
    a pre-loaded demo transcription with analysis.

    The rawSegments and cleanedSegments use the same format as Core API,
    allowing the frontend to reuse transformApiSegments() and get
    word-level timing for playback highlighting.
    """

    locale: str
    version: str
    filename: str
    durationSeconds: float
    speakerCount: int
    rawSegments: list[RawSegment]
    cleanedSegments: list[CleanedSegment]
    analyses: list[DemoAnalysis]


# =============================================================================
# Helper Functions
# =============================================================================


def get_demo_file_path(
    locale: str, file_type: Literal["json", "audio"], settings: Settings
) -> Path:
    """Get the path to a demo file.

    Args:
        locale: Language code ('en' or 'sl')
        file_type: Type of file ('json' for data, 'audio' for mp3)
        settings: Application settings

    Returns:
        Path to the demo file

    Raises:
        HTTPException: If locale is invalid
    """
    if locale not in ("en", "sl"):
        raise HTTPException(status_code=400, detail="Invalid locale. Use 'en' or 'sl'.")

    base_path = Path(settings.DEMO_DATA_PATH)
    extension = "json" if file_type == "json" else "mp3"
    return base_path / f"{locale}.{extension}"


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/entry", response_model=DemoEntryResponse)
async def get_demo_entry(
    locale: str = "en",
    settings: Settings = Depends(get_settings),
):
    """Get demo entry data for a specific locale.

    Returns pre-computed transcription and analysis data for the demo.
    The frontend uses this to display a sample entry in the history sidebar
    and load it when the user clicks on it.

    Args:
        locale: Language code ('en' or 'sl'). Defaults to 'en'.

    Returns:
        DemoEntryResponse with all demo data

    Raises:
        404: If demo data file is not found (demo not configured)
        400: If locale is invalid
    """
    json_path = get_demo_file_path(locale, "json", settings)

    if not json_path.exists():
        logger.warning(f"Demo data not found at {json_path}")
        raise HTTPException(
            status_code=404,
            detail=f"Demo data not available for locale '{locale}'. "
            "Demo files need to be mounted in the data/demo directory.",
        )

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DemoEntryResponse(**data)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in demo file {json_path}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Demo data file is corrupted.",
        )
    except Exception as e:
        logger.error(f"Error reading demo file {json_path}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to load demo data.",
        )


@router.get("/audio/{locale}")
async def get_demo_audio(
    locale: str,
    settings: Settings = Depends(get_settings),
):
    """Stream demo audio file for a specific locale.

    The frontend audio player uses this endpoint to play the demo audio.
    Files are served with appropriate headers for streaming playback.

    Args:
        locale: Language code ('en' or 'sl')

    Returns:
        FileResponse streaming the audio file

    Raises:
        404: If audio file is not found
        400: If locale is invalid
    """
    audio_path = get_demo_file_path(locale, "audio", settings)

    if not audio_path.exists():
        logger.warning(f"Demo audio not found at {audio_path}")
        raise HTTPException(
            status_code=404,
            detail=f"Demo audio not available for locale '{locale}'. "
            "Demo files need to be mounted in the data/demo directory.",
        )

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=f"demo-{locale}.mp3",
    )
