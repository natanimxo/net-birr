import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DebtFieldChanged(str, enum.Enum):
    amount = "amount"
    status = "status"


class DebtHistory(Base):
    """
    Permanent audit log of every amount/status change made to a Debt. Rows here
    are append-only from the API's point of view - nothing in the app ever
    updates or deletes a DebtHistory row after it's written.
    """

    __tablename__ = "debt_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debts.id", ondelete="CASCADE"), nullable=False, index=True)
    field_changed: Mapped[DebtFieldChanged] = mapped_column(Enum(DebtFieldChanged, name="debt_field_changed"), nullable=False)
    old_value: Mapped[str] = mapped_column(String, nullable=False)
    new_value: Mapped[str] = mapped_column(String, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    debt: Mapped["Debt"] = relationship(back_populates="history")
