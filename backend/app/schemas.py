import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.account import AccountType
from app.models.category import CategoryKind
from app.models.debt import DebtStatus
from app.models.debt_history import DebtFieldChanged
from app.models.payment_submission import PaymentMethod, PaymentPlan, PaymentSubmissionStatus
from app.models.transaction import TransactionType
from app.models.user import ProfileType


# ---- Auth ----
class LoginInitResponse(BaseModel):
    token: str
    deep_link: str
    expires_in_seconds: int


class LoginPollResponse(BaseModel):
    status: str  # pending | confirmed | expired
    access_token: str | None = None
    is_new_user: bool | None = None


class SetProfileTypeRequest(BaseModel):
    profile_type: ProfileType


# ---- User ----
class UserOut(BaseModel):
    id: uuid.UUID
    telegram_username: str | None
    first_name: str | None
    profile_type: ProfileType | None
    is_admin: bool = False

    model_config = {"from_attributes": True}


# ---- Account ----
class AccountOut(BaseModel):
    id: uuid.UUID
    name: str
    type: AccountType
    is_default: bool

    model_config = {"from_attributes": True}


# ---- Category ----
class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    icon: str | None
    type: CategoryKind

    model_config = {"from_attributes": True}


# ---- Transaction ----
class TransactionCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    type: TransactionType
    category_id: uuid.UUID
    account_id: uuid.UUID | None = None  # falls back to user's default account
    note: str | None = None
    is_credit: bool = False
    # Required (validated in the router, not here) when is_credit=True - who owes
    # this money. counterparty_phone is optional since not every debtor's number
    # is known at entry time, but it's needed later for the Telegram reminder link.
    counterparty_name: str | None = None
    counterparty_phone: str | None = None


class TransactionOut(BaseModel):
    id: uuid.UUID
    amount: Decimal
    type: TransactionType
    category_id: uuid.UUID
    account_id: uuid.UUID
    note: str | None
    is_credit: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TodayResponse(BaseModel):
    transactions: list[TransactionOut]
    count_today: int
    free_daily_cap: int
    is_free_tier: bool
    cap_reached: bool


# ---- Payments / subscription ----
class PaymentAccountDetails(BaseModel):
    telebirr_number: str
    telebirr_name: str
    cbe_account: str
    awash_account: str


class PlansResponse(BaseModel):
    price_monthly_birr: int
    price_yearly_birr: int
    payment_details: PaymentAccountDetails


class PaymentSubmissionCreate(BaseModel):
    plan: PaymentPlan
    method: PaymentMethod
    sender_name: str
    transaction_id: str
    screenshot_url: str | None = None


class PaymentSubmissionOut(BaseModel):
    id: uuid.UUID
    plan: PaymentPlan
    amount: Decimal
    method: PaymentMethod
    sender_name: str
    transaction_id: str
    screenshot_url: str | None
    status: PaymentSubmissionStatus
    submitted_at: datetime
    reviewed_at: datetime | None
    # Telegram handle of the app account that submitted this (may differ from
    # sender_name, which is just the name typed into the payment app). Useful
    # for the admin to cross-check identity before approving.
    telegram_username: str | None = None

    model_config = {"from_attributes": True}


class RejectSubmissionRequest(BaseModel):
    reason: str | None = None


class UploadResponse(BaseModel):
    url: str


# ---- Debts ----
class DebtOut(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID | None
    counterparty_name: str
    counterparty_phone: str | None
    amount: Decimal
    status: DebtStatus
    created_at: datetime
    paid_at: datetime | None

    model_config = {"from_attributes": True}


class DebtUpdate(BaseModel):
    # Only the fields being changed need to be sent - anything omitted (None)
    # is left untouched. Every field that does change gets its own debt_history
    # row (see routers/debts.py) rather than being silently overwritten.
    amount: Decimal | None = Field(default=None, gt=0)
    status: DebtStatus | None = None


class DebtHistoryOut(BaseModel):
    id: uuid.UUID
    field_changed: DebtFieldChanged
    old_value: str
    new_value: str
    changed_at: datetime

    model_config = {"from_attributes": True}
