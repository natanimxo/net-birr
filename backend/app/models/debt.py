import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DebtStatus(str, enum.Enum):
    owed = "owed"
    paid = "paid"


class Debt(Base):
    """
    Tracks money owed to the user by a counterparty who is usually NOT an app
    user (a customer/debtor). Created when a transaction is marked as credit
    (Transaction.is_credit=True). Amount/status are never silently overwritten -
    every change is logged to debt_history (see DebtHistory) so the record stays
    tamper-evident, replacing paper's tamper-evidence with an audit trail instead.
    """

    __tablename__ = "debts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Nullable: the originating transaction could theoretically be removed later
    # without needing to delete the debt record itself.
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )
    counterparty_name: Mapped[str] = mapped_column(String, nullable=False)
    counterparty_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[DebtStatus] = mapped_column(Enum(DebtStatus, name="debt_status"), default=DebtStatus.owed, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="debts")
    history: Mapped[list["DebtHistory"]] = relationship(
        back_populates="debt", cascade="all, delete-orphan", order_by="DebtHistory.changed_at"
    )
