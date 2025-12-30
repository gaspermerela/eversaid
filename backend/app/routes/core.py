"""Core API proxy endpoints for transcription, entries, cleanup, and analysis."""

from typing import Optional

from fastapi import APIRouter, Body, Depends, Form, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core_client import CoreAPIClient, CoreAPIError, get_core_api
from app.models import Session as SessionModel
from app.rate_limit import RateLimitResult, require_rate_limit
from app.session import get_session

router = APIRouter(tags=["core"])


# =============================================================================
# Request Models
# =============================================================================


class UserEditRequest(BaseModel):
    """Request body for editing cleaned text."""

    edited_text: str


class AnalyzeRequest(BaseModel):
    """Request body for triggering analysis."""

    profile_id: str = "generic-conversation-summary"


# =============================================================================
# Transcription Endpoints
# =============================================================================


@router.post("/api/transcribe", status_code=202)
async def transcribe(
    request: Request,
    file: UploadFile,
    language: str = Form("sl"),
    enable_diarization: bool = Form(True),
    speaker_count: int = Form(2),
    enable_analysis: bool = Form(True),
    analysis_profile: str = Form("generic-conversation-summary"),
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
    _rate_limit: RateLimitResult = Depends(require_rate_limit("transcribe")),
):
    """Upload audio and start transcription + cleanup + analysis.

    Returns immediately with entry_id, transcription_id, etc.
    Poll /api/transcriptions/{id} for status.
    """
    file_content = await file.read()

    # Build form data for Core API
    files = {"file": (file.filename, file_content, file.content_type)}
    data = {
        "language": language,
        "enable_diarization": str(enable_diarization).lower(),
        "speaker_count": str(speaker_count),
    }

    # Only include analysis params if analysis is enabled
    if enable_analysis:
        data["analysis_profile"] = analysis_profile

    response = await core_api.client.post(
        "/api/v1/upload-transcribe-cleanup",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {session.access_token}"},
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    # Commit rate limit entry only after successful Core API call.
    # This ensures users aren't locked out due to failed requests.
    request.state.rate_limit_db.commit()

    return response.json()


@router.get("/api/transcriptions/{transcription_id}")
async def get_transcription(
    transcription_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Get transcription status, text, and segments."""
    response = await core_api.request(
        "GET",
        f"/api/v1/transcriptions/{transcription_id}",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


# =============================================================================
# Entry Endpoints
# =============================================================================


@router.get("/api/entries")
async def list_entries(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    entry_type: Optional[str] = Query(default=None),
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """List all entries for the current session."""
    params = {"limit": limit, "offset": offset}
    if entry_type:
        params["entry_type"] = entry_type

    response = await core_api.request(
        "GET",
        "/api/v1/entries",
        session.access_token,
        params=params,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


@router.get("/api/entries/{entry_id}")
async def get_entry(
    entry_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Get entry details with transcription."""
    response = await core_api.request(
        "GET",
        f"/api/v1/entries/{entry_id}",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


@router.delete("/api/entries/{entry_id}")
async def delete_entry(
    entry_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Delete an entry and all associated data."""
    response = await core_api.request(
        "DELETE",
        f"/api/v1/entries/{entry_id}",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


@router.get("/api/entries/{entry_id}/audio")
async def get_entry_audio(
    entry_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Stream the audio file for an entry."""
    headers = {"Authorization": f"Bearer {session.access_token}"}

    # Use streaming to avoid loading entire file in memory
    async def stream_audio():
        async with core_api.client.stream(
            "GET",
            f"/api/v1/entries/{entry_id}/audio",
            headers=headers,
        ) as response:
            if response.status_code >= 400:
                raise CoreAPIError(
                    status_code=response.status_code,
                    detail=f"Failed to fetch audio: {response.status_code}",
                )
            async for chunk in response.aiter_bytes():
                yield chunk

    return StreamingResponse(
        stream_audio(),
        media_type="audio/wav",
        headers={"Content-Disposition": f"attachment; filename={entry_id}.wav"},
    )


# =============================================================================
# Cleanup Endpoints
# =============================================================================


@router.get("/api/cleaned-entries/{cleanup_id}")
async def get_cleaned_entry(
    cleanup_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Get cleanup details including cleaned text and segments."""
    response = await core_api.request(
        "GET",
        f"/api/v1/cleaned-entries/{cleanup_id}",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


@router.put("/api/cleaned-entries/{cleanup_id}/user-edit")
async def update_user_edit(
    cleanup_id: str,
    body: UserEditRequest,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Save user edits to cleaned text."""
    response = await core_api.request(
        "PUT",
        f"/api/v1/cleaned-entries/{cleanup_id}/user-edit",
        session.access_token,
        json=body.model_dump(),
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


@router.delete("/api/cleaned-entries/{cleanup_id}/user-edit")
async def revert_user_edit(
    cleanup_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Revert to AI-generated cleaned text."""
    response = await core_api.request(
        "DELETE",
        f"/api/v1/cleaned-entries/{cleanup_id}/user-edit",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


# =============================================================================
# Analysis Endpoints
# =============================================================================


@router.get("/api/analysis-profiles")
async def list_analysis_profiles(
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """List available analysis profiles."""
    response = await core_api.request(
        "GET",
        "/api/v1/analysis-profiles",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


@router.post("/api/cleaned-entries/{cleanup_id}/analyze")
async def trigger_analysis(
    request: Request,
    cleanup_id: str,
    body: AnalyzeRequest = Body(default=AnalyzeRequest()),
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
    _rate_limit: RateLimitResult = Depends(require_rate_limit("analyze")),
):
    """Trigger analysis on a cleaned entry."""
    response = await core_api.request(
        "POST",
        f"/api/v1/cleaned-entries/{cleanup_id}/analyze",
        session.access_token,
        json=body.model_dump(),
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    # Commit rate limit entry only after successful Core API call.
    # This ensures users aren't locked out due to failed requests.
    request.state.rate_limit_db.commit()

    return response.json()


@router.get("/api/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Get analysis status and results."""
    response = await core_api.request(
        "GET",
        f"/api/v1/analyses/{analysis_id}",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()
