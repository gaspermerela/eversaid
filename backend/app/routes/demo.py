"""Demo content endpoints for serving pre-loaded demo entries.

Demo files contain raw Core API responses, stored by generate_demo_content.py.
This endpoint transforms them to EntryDetails format - the same format used by
/api/entries/{id} - so frontend can use the same loading logic for both.

Expected file structure in DEMO_DATA_PATH:
    {locale}.json  - Raw Core API responses (transcription + cleanup + analyses)
    {locale}.mp3   - Demo audio file
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import Settings, get_settings


router = APIRouter(prefix="/api/demo", tags=["demo"])
logger = logging.getLogger(__name__)


# =============================================================================
# Response Models (matching EntryDetails format from frontend types.ts)
# =============================================================================


class TranscriptionWord(BaseModel):
    """Word-level timing data from transcription API."""

    text: str
    start: float
    end: float
    type: str = "word"
    speaker_id: int | None = None


class ApiSegment(BaseModel):
    """A raw transcription segment."""

    id: str
    start: float
    end: float
    text: str
    speaker: int | None = None
    words: list[TranscriptionWord] | None = None


class CleanedSegment(BaseModel):
    """A cleaned transcription segment."""

    id: str
    start: float
    end: float
    text: str
    speaker: int | None = None
    raw_segment_id: str | None = None
    spellcheck_errors: list[dict[str, Any]] | None = None


class TranscriptionStatus(BaseModel):
    """Transcription data matching frontend TranscriptionStatus type."""

    id: str
    status: str = "completed"
    transcribed_text: str | None = None
    segments: list[ApiSegment] | None = None
    words: list[TranscriptionWord] | None = None


class CleanedEntry(BaseModel):
    """Cleanup data matching frontend CleanedEntry type."""

    id: str
    voice_entry_id: str
    transcription_id: str
    user_id: str = "demo"
    cleaned_text: str | None = None
    status: str = "completed"
    model_name: str = "demo"
    is_primary: bool = True
    created_at: str
    cleaned_segments: list[CleanedSegment] | None = None
    cleanup_data_edited: list[CleanedSegment] | None = None


class AnalysisResult(BaseModel):
    """Analysis result matching frontend AnalysisResult type."""

    id: str
    cleaned_entry_id: str
    user_id: str = "demo"
    profile_id: str
    profile_label: str | None = None
    result: dict[str, Any] | None = None
    status: str = "completed"
    model_name: str = "demo"
    created_at: str


class DemoEntryResponse(BaseModel):
    """Full demo entry data matching EntryDetails format.

    This schema matches what /api/entries/{id} returns, allowing the frontend
    to use the same loadEntry() function for both real and demo entries.
    """

    id: str
    original_filename: str
    saved_filename: str
    duration_seconds: float
    entry_type: str = "demo"
    uploaded_at: str
    primary_transcription: TranscriptionStatus | None = None
    cleanup: CleanedEntry | None = None
    analyses: list[AnalysisResult] | None = None


# =============================================================================
# Transformation (raw Core API → EntryDetails format)
# =============================================================================


def transform_raw_to_entry_details(data: dict, locale: str) -> dict:
    """Transform raw Core API responses to EntryDetails format.

    This produces the same structure as GET /api/entries/{id}, allowing
    the frontend to use a single code path for both real and demo entries.
    """
    transcription = data["transcription"]
    cleanup = data["cleanup"]
    analyses = data["analyses"]

    now = datetime.now(timezone.utc).isoformat()
    demo_id = f"demo-{locale}"
    transcription_id = f"demo-transcription-{locale}"
    cleanup_id = f"demo-cleanup-{locale}"

    segments = transcription.get("segments", [])
    words = transcription.get("words", [])

    # Transform raw segments with word-level timing
    api_segments = []
    for i, seg in enumerate(segments):
        api_seg = {
            "id": f"seg-{i}",
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"],
            "speaker": seg.get("speaker"),
        }
        # Distribute words to segments by time range
        seg_words = [w for w in words if seg["start"] <= w.get("start", 0) < seg["end"]]
        if seg_words:
            api_seg["words"] = [
                {"text": w["text"], "start": w["start"], "end": w["end"],
                 "type": w.get("type", "word"), "speaker_id": w.get("speaker")}
                for w in seg_words
            ]
        api_segments.append(api_seg)

    # Transform cleaned segments
    cleaned_segments = [
        {
            "id": f"clean-{i}",
            "start": api_segments[i]["start"] if i < len(api_segments) else 0,
            "end": api_segments[i]["end"] if i < len(api_segments) else 0,
            "text": seg["text"],
            "speaker": seg.get("speaker"),
            "raw_segment_id": f"seg-{i}",
        }
        for i, seg in enumerate(cleanup.get("cleaned_segments", []))
    ]

    # Flatten words for the transcription response
    flat_words = [
        {"text": w["text"], "start": w["start"], "end": w["end"],
         "type": w.get("type", "word"), "speaker_id": w.get("speaker")}
        for w in words
    ]

    return {
        "id": demo_id,
        "original_filename": f"demo-{locale}.mp3",
        "saved_filename": f"demo-{locale}.mp3",
        "duration_seconds": transcription.get("duration_seconds", 0),
        "entry_type": "demo",
        "uploaded_at": now,
        "primary_transcription": {
            "id": transcription_id,
            "status": "completed",
            "transcribed_text": transcription.get("transcribed_text"),
            "segments": api_segments,
            "words": flat_words,
        },
        "cleanup": {
            "id": cleanup_id,
            "voice_entry_id": demo_id,
            "transcription_id": transcription_id,
            "user_id": "demo",
            "cleaned_text": cleanup.get("cleaned_text"),
            "status": "completed",
            "model_name": "demo",
            "is_primary": True,
            "created_at": now,
            "cleaned_segments": cleaned_segments,
            "cleanup_data_edited": None,
        },
        "analyses": [
            {
                "id": f"demo-analysis-{a['profile_id']}",
                "cleaned_entry_id": cleanup_id,
                "user_id": "demo",
                "profile_id": a["profile_id"],
                "profile_label": a.get("profile_label"),
                "result": a.get("result", {}),
                "status": "completed",
                "model_name": "demo",
                "created_at": now,
            }
            for a in analyses
        ],
    }


# =============================================================================
# Endpoints
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


@router.get("/entry", response_model=DemoEntryResponse)
async def get_demo_entry(
    locale: str = "en",
    settings: Settings = Depends(get_settings),
):
    """Get demo entry data for a specific locale.

    Returns data in EntryDetails format - the same format as /api/entries/{id}.
    This allows the frontend to use the same loadEntry() function for both
    real and demo entries.

    Args:
        locale: Language code ('en' or 'sl'). Defaults to 'en'.

    Returns:
        DemoEntryResponse matching EntryDetails structure

    Raises:
        404: If demo data file is not found (demo not configured)
        400: If locale is invalid
    """
    json_path = get_demo_file_path(locale, "json", settings)

    if not json_path.exists():
        logger.warning(f"Demo data not found at {json_path}")
        raise HTTPException(
            status_code=404,
            detail=f"Demo data not available for locale '{locale}'.",
        )

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        demo_data = transform_raw_to_entry_details(raw_data, locale)
        return DemoEntryResponse(**demo_data)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in demo file {json_path}: {e}")
        raise HTTPException(status_code=500, detail="Demo data file is corrupted.")
    except KeyError as e:
        logger.error(f"Missing key in demo file {json_path}: {e}")
        raise HTTPException(status_code=500, detail="Demo data file has invalid structure.")


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
            detail=f"Demo audio not available for locale '{locale}'.",
        )

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=f"demo-{locale}.mp3",
    )
