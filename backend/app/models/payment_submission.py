import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PaymentPlan(str, enum.Enum):
    monthly = "monthly"
    yearly = "yearly"


class PaymentMethod(str, enum.Enum):
    telebirr = "telebirr"
    cbe = "cbe"
    awash = "awash"
    other = "other"


class PaymentSubmissionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PaymentSubmission(Base):
    """
    Manual payment verification (Ethio Matric-style): user pays independently via
    Telebirr/CBE/Awash, then submits proof here for the admin (owner) to manually
    review and approve, which flips their subscription to active.
    """

    __tablename__ = "payment_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan: Mapped[PaymentPlan] = mapped_column(Enum(PaymentPlan, name="payment_plan"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod, name="payment_method"), nullable=False)
    sender_name: Mapped[str] = mapped_column(String, nullable=False)
    transaction_id: Mapped[str] = mapped_column(String, nullable=False)
    screenshot_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[PaymentSubmissionStatus] = mapped_column(
        Enum(PaymentSubmissionStatus, name="payment_submission_status"), default=PaymentSubmissionStatus.pending, nullable=False
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="payment_submissions")

    @property
    def telegram_username(self) -> str | None:
        return self.user.telegram_username if self.user else None
