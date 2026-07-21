import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CategoryKind(str, enum.Enum):
    income = "income"
    expense = "expense"


class CategoryProfile(str, enum.Enum):
    personal = "personal"
    business = "business"
    both = "both"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Null = default/system category, shared across all users.
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    icon: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[CategoryKind] = mapped_column(Enum(CategoryKind, name="category_kind"), nullable=False)
    profile_type: Mapped[CategoryProfile] = mapped_column(Enum(CategoryProfile, name="category_profile"), nullable=False, default=CategoryProfile.both)
