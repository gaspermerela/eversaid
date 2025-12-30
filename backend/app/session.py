"""Session management for anonymous users."""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session as DBSession

from app.config import Settings, get_settings
from app.core_client import CoreAPIClient, CoreAPIError, get_core_api
from app.database import get_db
from app.models import Session as SessionModel

# Cookie configuration
SESSION_COOKIE_NAME = "eversaid_session_id"
TOKEN_EXPIRY_DAYS = 7  # Assumed access token expiry (Core API default)
TOKEN_REFRESH_THRESHOLD_HOURS = 1  # Refresh if within this many hours of expiry


async def _create_anonymous_session(
    core_api: CoreAPIClient,
    db: DBSession,
    settings: Settings,
    ip_address: Optional[str] = None,
) -> SessionModel:
    """Create a new anonymous session in Core API and local DB.

    Args:
        core_api: CoreAPIClient instance
        db: Database session
        settings: Application settings
        ip_address: Client IP address (optional)

    Returns:
        New SessionModel instance

    Raises:
        HTTPException: If Core API registration/login fails
    """
    session_id = str(uuid.uuid4())
    email = f"anon-{session_id}@demo.eversaid.local"
    password = secrets.token_urlsafe(32)

    try:
        # Register anonymous user in Core API
        await core_api.register(email=email, password=password)

        # Login to get tokens
        token_response = await core_api.login(email=email, password=password)
    except CoreAPIError as e:
        if e.status_code == 503:
            raise HTTPException(
                status_code=503,
                detail="Core API service unavailable",
            ) from e
        raise HTTPException(
            status_code=502,
            detail=f"Failed to create session: {e.detail}",
        ) from e

    now = datetime.utcnow()

    session = SessionModel(
        session_id=session_id,
        core_api_email=email,
        access_token=token_response["access_token"],
        refresh_token=token_response["refresh_token"],
        token_expires_at=now + timedelta(days=TOKEN_EXPIRY_DAYS),
        created_at=now,
        expires_at=now + timedelta(days=settings.SESSION_DURATION_DAYS),
        ip_address=ip_address,
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session


async def _refresh_session_tokens(
    session: SessionModel,
    core_api: CoreAPIClient,
    db: DBSession,
) -> SessionModel:
    """Refresh tokens for an existing session.

    Args:
        session: Existing session to refresh
        core_api: CoreAPIClient instance
        db: Database session

    Returns:
        Updated SessionModel instance

    Raises:
        HTTPException: If token refresh fails
    """
    try:
        token_response = await core_api.refresh(session.refresh_token)
    except CoreAPIError as e:
        if e.status_code == 401:
            # Refresh token expired or invalid - session is dead
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please refresh the page.",
            ) from e
        if e.status_code == 503:
            raise HTTPException(
                status_code=503,
                detail="Core API service unavailable",
            ) from e
        raise HTTPException(
            status_code=502,
            detail=f"Failed to refresh session: {e.detail}",
        ) from e

    session.access_token = token_response["access_token"]
    session.refresh_token = token_response["refresh_token"]
    session.token_expires_at = datetime.utcnow() + timedelta(days=TOKEN_EXPIRY_DAYS)

    db.commit()
    db.refresh(session)

    return session


def _set_session_cookie(
    response: Response,
    session_id: str,
    settings: Settings,
) -> None:
    """Set the session cookie on the response.

    Args:
        response: FastAPI response object
        session_id: Session ID to store in cookie
        settings: Application settings
    """
    max_age = settings.SESSION_DURATION_DAYS * 86400  # seconds

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        # secure=True should be set in production via reverse proxy
    )


async def get_or_create_session(
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    core_api: CoreAPIClient = Depends(get_core_api),
) -> SessionModel:
    """FastAPI dependency to get or create an anonymous session.

    Flow:
    1. Check for session_id cookie
    2. If cookie exists, load session from DB
    3. If session expired (past expires_at), create new session
    4. If token near expiry, refresh tokens
    5. If no cookie, create anonymous user in Core API and store session

    Args:
        request: FastAPI request object
        response: FastAPI response object
        db: Database session
        settings: Application settings
        core_api: CoreAPIClient instance

    Returns:
        SessionModel instance (existing or newly created)
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    ip_address = request.client.host if request.client else None

    if session_id:
        # Try to load existing session
        session = db.query(SessionModel).filter(
            SessionModel.session_id == session_id
        ).first()

        if session:
            now = datetime.utcnow()

            # Check if session has expired
            if session.expires_at < now:
                # Session expired - create new one
                db.delete(session)
                db.commit()
                session = await _create_anonymous_session(
                    core_api=core_api,
                    db=db,
                    settings=settings,
                    ip_address=ip_address,
                )
                _set_session_cookie(response, session.session_id, settings)
                return session

            # Check if token needs refresh (within threshold of expiry)
            refresh_threshold = now + timedelta(hours=TOKEN_REFRESH_THRESHOLD_HOURS)
            if session.token_expires_at < refresh_threshold:
                session = await _refresh_session_tokens(
                    session=session,
                    core_api=core_api,
                    db=db,
                )

            return session

    # No valid session - create new one
    session = await _create_anonymous_session(
        core_api=core_api,
        db=db,
        settings=settings,
        ip_address=ip_address,
    )
    _set_session_cookie(response, session.session_id, settings)

    return session


# Alias for cleaner imports in routes
get_session = get_or_create_session
