"""Core API proxy endpoints for transcription, entries, cleanup, and analysis."""

from typing import Optional

from fastapi import APIRouter, Body, Depends, Form, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from app.core_client import CoreAPIClient, CoreAPIError, get_core_api
from app.models import Session as SessionModel
from app.rate_limit import RateLimitResult, require_rate_limit
from app.session import get_session

router = APIRouter(tags=["core"])


# =============================================================================
# Options Endpoint (Public)
# =============================================================================


@router.get("/api/options")
async def get_options(
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Get available transcription and LLM options from Core API.

    Returns available models, providers, and parameters.
    No authentication required - public endpoint.
    """
    response = await core_api.client.get("/api/v1/options")

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


# =============================================================================
# Request Models
# =============================================================================


class CleanupRequest(BaseModel):
    """Request body for triggering cleanup."""

    cleanup_type: Optional[str] = "corrected"  # verbatim, corrected, formal
    llm_model: Optional[str] = None
    temperature: Optional[float] = None  # 0-2, not sent if None


class UserEditRequest(BaseModel):
    """Request body for editing cleaned text (words-first format)."""

    edited_data: dict  # TranscriptionData structure with words array


class AnalyzeRequest(BaseModel):
    """Request body for triggering analysis."""

    profile_id: str = "generic-summary"
    llm_model: Optional[str] = None  # Optional LLM model override


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
    analysis_profile: str = Form("generic-summary"),
    # Cleanup options
    cleanup_type: str = Form("corrected"),  # verbatim, corrected, formal
    llm_model: Optional[str] = Form(None),  # LLM model for cleanup
    # Analysis options (separate from cleanup)
    analysis_llm_model: Optional[str] = Form(None),  # LLM model for analysis
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
        "cleanup_type": cleanup_type,
    }

    # Add optional LLM model for cleanup
    if llm_model:
        data["llm_model"] = llm_model

    # Only include analysis params if analysis is enabled
    if enable_analysis:
        data["analysis_profile"] = analysis_profile
        # Add optional LLM model for analysis (separate from cleanup)
        if analysis_llm_model:
            data["analysis_llm_model"] = analysis_llm_model

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
    """Get entry details with transcription segments and cleanup.

    WORKAROUND: The core API's GET /entries/{id} endpoint returns entry metadata
    and transcription summary, but NOT segments or cleanup data.

    This wrapper composes a full response by:
    1. Fetching entry details (includes primary_transcription summary)
    2. Fetching full transcription with segments
    3. Fetching entries list to find this entry's cleanup_id
    4. Fetching cleanup details if available

    TODO: This should be fixed in the core API to return all data directly,
    eliminating the need for multiple round-trips.
    """
    # 1. Fetch entry details (includes primary_transcription summary)
    entry_response = await core_api.request(
        "GET",
        f"/api/v1/entries/{entry_id}",
        session.access_token,
    )

    if entry_response.status_code >= 400:
        raise CoreAPIError(
            status_code=entry_response.status_code,
            detail=entry_response.text,
        )

    entry_data = entry_response.json()

    # 2. Fetch full transcription with segments if we have a transcription_id
    primary_transcription = entry_data.get("primary_transcription")
    if primary_transcription and primary_transcription.get("id"):
        transcription_id = primary_transcription["id"]
        transcription_response = await core_api.request(
            "GET",
            f"/api/v1/transcriptions/{transcription_id}",
            session.access_token,
        )
        if transcription_response.status_code == 200:
            full_transcription = transcription_response.json()
            # Merge segments into primary_transcription
            entry_data["primary_transcription"] = full_transcription

    # 3. Find cleanup_id from entries list (workaround for core API limitation)
    # The entries list includes latest_cleaned_entry.id which we need
    list_response = await core_api.request(
        "GET",
        "/api/v1/entries",
        session.access_token,
        params={"limit": 100},  # Fetch enough to find the entry # TODO: change the dirty fix
    )

    cleanup_id = None
    cleanup_data = None

    if list_response.status_code == 200:
        list_data = list_response.json()
        for entry in list_data.get("entries", []):
            if str(entry.get("id")) == entry_id:
                latest_cleaned = entry.get("latest_cleaned_entry")
                if latest_cleaned:
                    cleanup_id = latest_cleaned.get("id")
                break

    # 4. Fetch cleanup details if we found a cleanup_id
    if cleanup_id:
        cleanup_response = await core_api.request(
            "GET",
            f"/api/v1/cleaned-entries/{cleanup_id}",
            session.access_token,
        )
        if cleanup_response.status_code == 200:
            cleanup_data = cleanup_response.json()

    # 5. Fetch ALL analyses for this cleaned entry
    analyses = []
    if cleanup_id:
        analyses_response = await core_api.request(
            "GET",
            f"/api/v1/cleaned-entries/{cleanup_id}/analyses",
            session.access_token,
        )
        if analyses_response.status_code == 200:
            analyses_data = analyses_response.json()
            analyses = analyses_data.get("analyses", [])

    # 6. Compose response with cleanup and analysis data included
    entry_data["cleanup"] = cleanup_data
    entry_data["analyses"] = analyses  # All analyses for client-side caching

    return entry_data


@router.get("/api/entries/{entry_id}/cleaned")
async def list_cleaned_entries(
    entry_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """List all cleanup records for an entry.

    Returns all cleanups (not just the primary one) with model and level info,
    enabling the frontend to show which model+level combinations are cached.
    """
    response = await core_api.request(
        "GET",
        f"/api/v1/entries/{entry_id}/cleaned",
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
    """Stream the audio file for an entry.

    Captures headers from Core API response to ensure correct Content-Type
    and filename regardless of whether audio preprocessing is enabled.
    """
    auth_headers = {"Authorization": f"Bearer {session.access_token}"}

    # Start streaming request to Core API
    # We'll capture headers from the response before streaming body
    client_stream = core_api.client.stream(
        "GET",
        f"/api/v1/entries/{entry_id}/audio",
        headers=auth_headers,
    )

    response = await client_stream.__aenter__()

    if response.status_code >= 400:
        await client_stream.__aexit__(None, None, None)
        raise CoreAPIError(
            status_code=response.status_code,
            detail=f"Failed to fetch audio: {response.status_code}",
        )

    # Capture headers from Core API response
    content_type = response.headers.get("content-type", "application/octet-stream")
    content_length = response.headers.get("content-length")
    content_disposition = response.headers.get(
        "content-disposition",
        f"inline; filename={entry_id}",
    )

    # Stream the body - no cleanup in finally block to avoid
    # "anext(): asynchronous generator is already running" error
    # when client disconnects during streaming
    async def stream_audio():
        async for chunk in response.aiter_bytes():
            yield chunk

    # Cleanup function runs as background task after response completes
    async def cleanup():
        await client_stream.__aexit__(None, None, None)

    # Build response headers - pass through from Core API
    response_headers = {
        "Content-Disposition": content_disposition,
        "Accept-Ranges": "bytes",
    }

    # Add Content-Length if available - helps browser calculate duration
    if content_length:
        response_headers["Content-Length"] = content_length

    return StreamingResponse(
        stream_audio(),
        media_type=content_type,
        headers=response_headers,
        background=BackgroundTask(cleanup),
    )


# =============================================================================
# Cleanup Endpoints
# =============================================================================


@router.post("/api/transcriptions/{transcription_id}/cleanup", status_code=202)
async def trigger_cleanup(
    transcription_id: str,
    body: CleanupRequest = Body(default=CleanupRequest()),
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """Trigger LLM cleanup for a completed transcription.

    Used for entries that have transcription but no cleanup (e.g., demo entries
    created by PostgreSQL trigger).
    """
    # Build request body with optional params
    request_body = {"type": body.cleanup_type}
    if body.llm_model:
        request_body["llm_model"] = body.llm_model
    if body.temperature is not None:
        request_body["temperature"] = body.temperature

    response = await core_api.request(
        "POST",
        f"/api/v1/transcriptions/{transcription_id}/cleanup",
        session.access_token,
        json=request_body,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()


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
    # Exclude None values to avoid sending nulls to Core API
    response = await core_api.request(
        "POST",
        f"/api/v1/cleaned-entries/{cleanup_id}/analyze",
        session.access_token,
        json=body.model_dump(exclude_none=True),
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


@router.get("/api/cleaned-entries/{cleanup_id}/analyses")
async def list_analyses(
    cleanup_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
):
    """List all analyses for a cleaned entry."""
    response = await core_api.request(
        "GET",
        f"/api/v1/cleaned-entries/{cleanup_id}/analyses",
        session.access_token,
    )

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

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
