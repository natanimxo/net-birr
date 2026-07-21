import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LoginSessionStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    consumed = "consumed"
    expired = "expired"


class LoginSession(Base):
    """
    One row per "Login with Telegram" attempt from the mobile app.
    Flow: app creates a pending row + deep link -> user taps it in Telegram ->
    our bot's /start handler flips it to confirmed -> app polls and exchanges
    it for a JWT, which flips it to consumed so it can't be reused.
    """

    __tablename__ = "login_sessions"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[LoginSessionStatus] = mapped_column(Enum(LoginSessionStatus, name="login_session_status"), default=LoginSessionStatus.pending, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
