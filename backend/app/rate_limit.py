"""Rate limiting module for transcribe and LLM endpoints.

Key Design Decisions (documented per user request):

1. MIDDLEWARE FOR HEADERS: We use middleware to add rate limit headers because
   it's the cleanest way to add headers to ALL responses (both success and error).
   The alternative of adding headers in each endpoint would miss error responses.

2. COUNT ATTEMPTS, NOT SUCCESSES: We commit the rate limit entry immediately
   after the check passes, before the Core API call. This means we count
   attempts, not just successful operations. This is intentional - otherwise
   users could spam failed requests and bypass rate limiting.

3. LONGEST WAIT WINS: When multiple limits are exceeded (e.g., both hourly AND
   daily), we report the limit with the LONGEST retry_after time. This prevents
   misleading messages like "try again in 45 minutes" when the daily limit would
   still block them. Instead, they see "try again tomorrow" - the accurate message.

4. RESET = NOW + WINDOW: We calculate reset time as current_time + window_size
   rather than tracking the oldest entry. This is a conservative estimate that's
   simpler to implement and always safe (actual reset may be sooner).
"""

from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.config import Settings, get_settings
from app.database import get_db
from app.models import RateLimitEntry, Session as SessionModel
from app.session import get_session


# =============================================================================
# Pydantic Models
# =============================================================================


class LimitInfo(BaseModel):
    """Information about a single rate limit tier."""

    limit: int
    remaining: int
    reset: int  # Unix timestamp when this limit resets


class RateLimitResult(BaseModel):
    """Complete rate limit status across all tiers."""

    allowed: bool
    hour: LimitInfo
    day: LimitInfo
    ip_day: LimitInfo
    global_day: LimitInfo
    exceeded_type: Optional[Literal["hour", "day", "ip_day", "global_day"]] = None
    retry_after: Optional[int] = None


# =============================================================================
# Exception
# =============================================================================


class RateLimitExceeded(HTTPException):
    """Exception raised when rate limit is exceeded.

    Contains the full RateLimitResult for building response headers and body.
    """

    def __init__(self, result: RateLimitResult):
        self.result = result

        # Build user-friendly message based on which limit was exceeded
        messages = {
            "hour": "Hourly limit reached",
            "day": "Daily limit reached",
            "ip_day": "IP daily limit reached",
            "global_day": "Global daily limit reached - service is busy",
        }
        message = messages.get(result.exceeded_type, "Rate limit exceeded")

        super().__init__(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "message": message,
                "limit_type": result.exceeded_type,
                "retry_after": result.retry_after,
                "limits": {
                    "hour": result.hour.model_dump(),
                    "day": result.day.model_dump(),
                    "ip_day": result.ip_day.model_dump(),
                    "global_day": result.global_day.model_dump(),
                },
            },
        )


# =============================================================================
# Rate Limit Tracker
# =============================================================================


class RateLimitTracker:
    """Tracks and enforces rate limits across four tiers.

    This class adds entries to the database session but does NOT commit.
    The caller (require_rate_limit dependency) handles the commit after
    the check passes. See "COUNT ATTEMPTS, NOT SUCCESSES" design decision.
    """

    def __init__(self, settings: Settings):
        self.settings = settings

    def _get_limits(self, action: str) -> tuple[int, int, int, int]:
        """Get limit values based on action type.

        Returns: (hour_limit, day_limit, ip_day_limit, global_day_limit)
        """
        if action == "analyze":
            return (
                self.settings.RATE_LIMIT_LLM_HOUR,
                self.settings.RATE_LIMIT_LLM_DAY,
                self.settings.RATE_LIMIT_LLM_IP_DAY,
                self.settings.RATE_LIMIT_LLM_GLOBAL_DAY,
            )
        # Default to transcribe limits
        return (
            self.settings.RATE_LIMIT_HOUR,
            self.settings.RATE_LIMIT_DAY,
            self.settings.RATE_LIMIT_IP_DAY,
            self.settings.RATE_LIMIT_GLOBAL_DAY,
        )

    def _count_entries(
        self,
        db: DBSession,
        action: str,
        since: datetime,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> int:
        """Count rate limit entries matching criteria since a given time."""
        query = db.query(func.count(RateLimitEntry.id)).filter(
            RateLimitEntry.action == action,
            RateLimitEntry.created_at >= since,
        )
        if session_id:
            query = query.filter(RateLimitEntry.session_id == session_id)
        if ip_address:
            query = query.filter(RateLimitEntry.ip_address == ip_address)
        return query.scalar() or 0

    def check_and_increment(
        self,
        session_id: str,
        ip_address: str,
        db: DBSession,
        action: str = "transcribe",
    ) -> RateLimitResult:
        """Check all rate limits and add entry if allowed.

        Design Decision: Longest wait wins
        -------------------------------------
        When multiple limits are exceeded, we report the one with the LONGEST
        retry_after. If both hourly AND daily limits are hit, the user sees
        "try again tomorrow" (accurate) rather than "try again in 45 minutes"
        (misleading - they'd still be blocked after waiting).

        Design Decision: Reset = now + window
        ----------------------------------------
        We calculate reset as current_time + window_size. This is conservative
        (actual reset may be sooner) but simpler than tracking oldest entry.
        """
        now = datetime.utcnow()
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)

        hour_limit, day_limit, ip_day_limit, global_day_limit = self._get_limits(action)

        # Count current usage for each tier
        hour_count = self._count_entries(db, action, hour_ago, session_id=session_id)
        day_count = self._count_entries(db, action, day_ago, session_id=session_id)
        ip_day_count = self._count_entries(db, action, day_ago, ip_address=ip_address)
        global_day_count = self._count_entries(db, action, day_ago)

        # Calculate reset times (now + window as conservative estimate)
        hour_reset = int((now + timedelta(hours=1)).timestamp())
        day_reset = int((now + timedelta(days=1)).timestamp())
        now_ts = int(now.timestamp())

        # Build limit info for each tier
        hour_info = LimitInfo(
            limit=hour_limit,
            remaining=max(0, hour_limit - hour_count),
            reset=hour_reset,
        )
        day_info = LimitInfo(
            limit=day_limit,
            remaining=max(0, day_limit - day_count),
            reset=day_reset,
        )
        ip_day_info = LimitInfo(
            limit=ip_day_limit,
            remaining=max(0, ip_day_limit - ip_day_count),
            reset=day_reset,
        )
        global_day_info = LimitInfo(
            limit=global_day_limit,
            remaining=max(0, global_day_limit - global_day_count),
            reset=day_reset,
        )

        # Check which limits are exceeded and find the one with longest wait
        # Design Decision: Longest wait wins - see docstring above
        exceeded = []
        if hour_count >= hour_limit:
            exceeded.append(("hour", hour_reset - now_ts))
        if day_count >= day_limit:
            exceeded.append(("day", day_reset - now_ts))
        if ip_day_count >= ip_day_limit:
            exceeded.append(("ip_day", day_reset - now_ts))
        if global_day_count >= global_day_limit:
            exceeded.append(("global_day", day_reset - now_ts))

        if exceeded:
            # Find the limit with the longest retry_after time
            exceeded.sort(key=lambda x: x[1], reverse=True)
            exceeded_type, retry_after = exceeded[0]

            return RateLimitResult(
                allowed=False,
                hour=hour_info,
                day=day_info,
                ip_day=ip_day_info,
                global_day=global_day_info,
                exceeded_type=exceeded_type,
                retry_after=retry_after,
            )

        # All limits passed - add entry (caller will commit)
        entry = RateLimitEntry(
            session_id=session_id,
            ip_address=ip_address,
            action=action,
        )
        db.add(entry)

        # Update remaining counts (decremented by 1 since we added an entry)
        hour_info.remaining = max(0, hour_info.remaining - 1)
        day_info.remaining = max(0, day_info.remaining - 1)
        ip_day_info.remaining = max(0, ip_day_info.remaining - 1)
        global_day_info.remaining = max(0, global_day_info.remaining - 1)

        return RateLimitResult(
            allowed=True,
            hour=hour_info,
            day=day_info,
            ip_day=ip_day_info,
            global_day=global_day_info,
        )


# =============================================================================
# Dependency Factory
# =============================================================================


def require_rate_limit(action: str = "transcribe"):
    """Factory that creates a rate limit dependency for a specific action.

    Usage:
        @router.post("/api/transcribe")
        async def transcribe(
            rate_limit: RateLimitResult = Depends(require_rate_limit("transcribe")),
        ):
            ...

        @router.post("/api/cleaned-entries/{id}/analyze")
        async def analyze(
            rate_limit: RateLimitResult = Depends(require_rate_limit("analyze")),
        ):
            ...
    """

    async def dependency(
        request: Request,
        session: SessionModel = Depends(get_session),
        db: DBSession = Depends(get_db),
        settings: Settings = Depends(get_settings),
    ) -> RateLimitResult:
        tracker = RateLimitTracker(settings)
        result = tracker.check_and_increment(
            session_id=session.session_id,
            ip_address=session.ip_address or request.client.host,
            db=db,
            action=action,
        )

        if not result.allowed:
            raise RateLimitExceeded(result)

        # Commit the rate limit entry to the database.
        # Note: We commit here rather than waiting for the endpoint to succeed
        # because we want to count the attempt, not just successful operations.
        # Otherwise users could spam failed requests and bypass rate limiting.
        db.commit()

        # Store result in request state for middleware to add headers
        request.state.rate_limit_result = result
        return result

    return dependency
