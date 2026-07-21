from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas import TodayResponse, TransactionCreate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])
settings = get_settings()


def _today_start_utc() -> datetime:
    # Phase 1 simplification: UTC calendar day. Revisit with user-local timezones
    # once we have real usage - Ethiopia is a single timezone (EAT, UTC+3) so this
    # is an acceptable approximation for now, not a deliberate final design choice.
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _count_today(db: Session, user_id) -> int:
    return (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.created_at >= _today_start_utc())
        .count()
    )


def _is_free_tier(db: Session, current_user: User) -> bool:
    # Admins (the app owner, via ADMIN_TELEGRAM_IDS) always have full access - they
    # shouldn't need to submit a payment to themselves just to use their own app,
    # and it sidesteps the awkward self-approval question entirely for the sole-owner
    # case. Regular users still go through the normal subscription check.
    if current_user.is_admin:
        return False
    sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).one_or_none()
    return sub is None or sub.status != SubscriptionStatus.active


@router.get("/today", response_model=TodayResponse)
def get_today(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.created_at >= _today_start_utc())
        .order_by(Transaction.created_at.desc())
        .all()
    )
    count_today = len(transactions)
    is_free_tier = _is_free_tier(db, current_user)
    cap = settings.free_daily_transaction_cap

    return TodayResponse(
        transactions=transactions,
        count_today=count_today,
        free_daily_cap=cap,
        is_free_tier=is_free_tier,
        cap_reached=is_free_tier and count_today >= cap,
    )


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _is_free_tier(db, current_user):
        count_today = _count_today(db, current_user.id)
        if count_today >= settings.free_daily_transaction_cap:
            raise HTTPException(
                status_code=402,
                detail=f"Free plan is limited to {settings.free_daily_transaction_cap} transactions per day. Upgrade to keep logging today.",
            )

    category = db.get(Category, body.category_id)
    if category is None or (category.user_id is not None and category.user_id != current_user.id):
        raise HTTPException(status_code=404, detail="Category not found")

    account_id = body.account_id
    if account_id is None:
        default_account = (
            db.query(Account)
            .filter(Account.user_id == current_user.id, Account.is_default.is_(True))
            .one_or_none()
        )
        if default_account is None:
            raise HTTPException(status_code=400, detail="No default account found for user")
        account_id = default_account.id
    else:
        account = db.get(Account, account_id)
        if account is None or account.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Account not found")

    transaction = Transaction(
        user_id=current_user.id,
        account_id=account_id,
        category_id=body.category_id,
        amount=body.amount,
        type=body.type,
        note=body.note,
        is_credit=body.is_credit,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction
