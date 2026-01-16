"""Local-only endpoints for feedback collection and waitlist capture.

These endpoints store data in the wrapper's SQLite database only,
they do NOT proxy to the Core API (except for entry verification).
"""

from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session as DBSession

from app.config import Settings, get_settings
from app.core_client import CoreAPIClient, CoreAPIError, get_core_api
from app.database import get_db
from app.models import EntryFeedback, Session as SessionModel, Waitlist, generate_referral_code
from app.rate_limit import get_rate_limit_status
from app.session import get_session


router = APIRouter(tags=["local"])


# =============================================================================
# Rate Limit Endpoint
# =============================================================================


@router.get("/api/rate-limits")
async def get_rate_limits(
    request: Request,
    session: SessionModel = Depends(get_session),
    db: DBSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Get current rate limit status without consuming a request.

    Returns rate limit info via headers (reuses middleware).
    Call this on page load to display current limits.
    """
    # Get transcribe limits (primary action users care about)
    result = get_rate_limit_status(
        session_id=session.session_id,
        ip_address=session.ip_address or request.client.host,
        db=db,
        action="transcribe",
        settings=settings,
    )

    # Store in request state so middleware adds headers
    request.state.rate_limit_result = result

    # Return empty response - headers contain the data
    return {}


# =============================================================================
# Request/Response Models
# =============================================================================


class FeedbackRequest(BaseModel):
    """Request body for submitting feedback."""

    feedback_type: Literal["transcription", "cleanup", "analysis"]
    rating: int = Field(ge=1, le=5)
    feedback_text: Optional[str] = Field(default=None, max_length=1000)


class FeedbackResponse(BaseModel):
    """Response for feedback submission/retrieval."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    entry_id: str
    feedback_type: str
    rating: int
    feedback_text: Optional[str]
    created_at: datetime


class WaitlistRequest(BaseModel):
    """Request body for joining waitlist."""

    email: EmailStr
    use_case: Optional[str] = Field(default=None, max_length=500)
    waitlist_type: Literal["api_access", "extended_usage"]
    source_page: Optional[str] = None
    referred_by: Optional[str] = Field(default=None, max_length=20)


class WaitlistResponse(BaseModel):
    """Response for waitlist signup."""

    message: str
    referral_code: Optional[str] = None


# =============================================================================
# Feedback Endpoints
# =============================================================================


@router.post("/api/entries/{entry_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    entry_id: str,
    body: FeedbackRequest,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
    db: DBSession = Depends(get_db),
):
    """Submit feedback for an entry (upsert by feedback_type).

    Verifies entry exists in Core API before accepting feedback.
    If feedback already exists for this (session, entry, type), updates it.
    """
    # Verify entry exists in Core API
    response = await core_api.request(
        "GET",
        f"/api/v1/entries/{entry_id}",
        session.access_token,
    )

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Entry not found")

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    # Check for existing feedback (upsert logic)
    existing = (
        db.query(EntryFeedback)
        .filter(
            EntryFeedback.session_id == session.session_id,
            EntryFeedback.entry_id == entry_id,
            EntryFeedback.feedback_type == body.feedback_type,
        )
        .first()
    )

    if existing:
        # Update existing feedback
        existing.rating = body.rating
        existing.feedback_text = body.feedback_text
        existing.created_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new feedback
        feedback = EntryFeedback(
            session_id=session.session_id,
            entry_id=entry_id,
            feedback_type=body.feedback_type,
            rating=body.rating,
            feedback_text=body.feedback_text,
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return feedback


@router.get("/api/entries/{entry_id}/feedback", response_model=List[FeedbackResponse])
async def get_feedback(
    entry_id: str,
    session: SessionModel = Depends(get_session),
    core_api: CoreAPIClient = Depends(get_core_api),
    db: DBSession = Depends(get_db),
):
    """Get all feedback for an entry.

    Verifies entry exists in Core API before returning feedback.
    Returns all feedback types submitted by this session for the entry.
    """
    # Verify entry exists in Core API
    response = await core_api.request(
        "GET",
        f"/api/v1/entries/{entry_id}",
        session.access_token,
    )

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Entry not found")

    if response.status_code >= 400:
        raise CoreAPIError(
            status_code=response.status_code,
            detail=response.text,
        )

    # Get all feedback for this entry from this session
    feedback_list = (
        db.query(EntryFeedback)
        .filter(
            EntryFeedback.session_id == session.session_id,
            EntryFeedback.entry_id == entry_id,
        )
        .order_by(EntryFeedback.created_at.desc())
        .all()
    )

    return feedback_list


# =============================================================================
# Waitlist Endpoints
# =============================================================================


@router.post("/api/waitlist", response_model=WaitlistResponse)
async def join_waitlist(
    body: WaitlistRequest,
    db: DBSession = Depends(get_db),
):
    """Join the waitlist.

    Handles duplicate emails silently (returns success without leaking info).
    Does NOT require a session - this is a public endpoint.
    Generates a unique referral code for new signups.
    """
    # Check for existing email
    existing = db.query(Waitlist).filter(Waitlist.email == body.email).first()

    if existing:
        # Return success with existing referral code (without leaking new signups)
        return WaitlistResponse(
            message="Thank you for joining the waitlist!",
            referral_code=existing.referral_code,
        )

    # Validate referred_by code exists (if provided)
    validated_referred_by = None
    if body.referred_by:
        referrer = db.query(Waitlist).filter(Waitlist.referral_code == body.referred_by).first()
        if referrer:
            validated_referred_by = body.referred_by
        # If code doesn't exist, silently ignore (don't fail signup)

    # Generate unique referral code with collision retry
    referral_code = None
    for _ in range(5):  # Max 5 retries
        candidate = generate_referral_code()
        if not db.query(Waitlist).filter(Waitlist.referral_code == candidate).first():
            referral_code = candidate
            break

    if not referral_code:
        # Extremely unlikely, but fallback to UUID-based code
        import uuid
        referral_code = f"REF-{str(uuid.uuid4())[:8].upper()}"

    # Create new waitlist entry
    waitlist_entry = Waitlist(
        email=body.email,
        use_case=body.use_case,
        waitlist_type=body.waitlist_type,
        source_page=body.source_page,
        referral_code=referral_code,
        referred_by=validated_referred_by,
    )
    db.add(waitlist_entry)
    db.commit()

    return WaitlistResponse(
        message="Thank you for joining the waitlist!",
        referral_code=referral_code,
    )
