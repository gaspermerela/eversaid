import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.database import Base


def generate_uuid() -> str:
    """Generate a UUID string."""
    return str(uuid.uuid4())


class Session(Base):
    """Anonymous session tracking with Core API tokens."""

    __tablename__ = "sessions"

    session_id = Column(String, primary_key=True, default=generate_uuid)
    core_api_email = Column(String, nullable=False)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    token_expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    ip_address = Column(String, nullable=True)


class Waitlist(Base):
    """Email capture for waitlist."""

    __tablename__ = "waitlist"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False)
    use_case = Column(String, nullable=True)
    waitlist_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    source_page = Column(String, nullable=True)


class EntryFeedback(Base):
    """User feedback on transcriptions."""

    __tablename__ = "entry_feedback"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.session_id"), nullable=False)
    entry_id = Column(String, nullable=False)
    feedback_type = Column(String, nullable=False)  # transcription, cleanup, analysis
    rating = Column(Integer, nullable=False)  # 1-5
    feedback_text = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RateLimitEntry(Base):
    """Rate limit tracking."""

    __tablename__ = "rate_limit_entries"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    action = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
