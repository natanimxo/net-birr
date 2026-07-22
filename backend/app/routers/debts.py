import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.debt import Debt, DebtStatus
from app.models.debt_history import DebtFieldChanged, DebtHistory
from app.models.user import User
from app.schemas import DebtHistoryOut, DebtOut, DebtUpdate

router = APIRouter(prefix="/debts", tags=["debts"])


def _get_owned_debt(db: Session, debt_id: uuid.UUID, user_id: uuid.UUID) -> Debt:
    debt = db.get(Debt, debt_id)
    if debt is None or debt.user_id != user_id:
        raise HTTPException(status_code=404, detail="Debt not found")
    return debt


@router.get("", response_model=list[DebtOut])
def list_debts(
    status: DebtStatus | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Debt).filter(Debt.user_id == current_user.id)
    if status is not None:
        query = query.filter(Debt.status == status)
    return query.order_by(Debt.created_at.desc()).all()


@router.patch("/{debt_id}", response_model=DebtOut)
def update_debt(
    debt_id: uuid.UUID,
    body: DebtUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    debt = _get_owned_debt(db, debt_id, current_user.id)

    # Never allow a silent overwrite of amount/status - every change that
    # actually differs from the current value gets its own debt_history row
    # (old value, new value, timestamp) before the field is updated in place.
    if body.amount is not None and body.amount != debt.amount:
        db.add(
            DebtHistory(
                debt_id=debt.id,
                field_changed=DebtFieldChanged.amount,
                old_value=str(debt.amount),
                new_value=str(body.amount),
            )
        )
        debt.amount = body.amount

    if body.status is not None and body.status != debt.status:
        db.add(
            DebtHistory(
                debt_id=debt.id,
                field_changed=DebtFieldChanged.status,
                old_value=debt.status.value,
                new_value=body.status.value,
            )
        )
        debt.status = body.status
        debt.paid_at = datetime.now(timezone.utc) if body.status == DebtStatus.paid else None

    db.commit()
    db.refresh(debt)
    return debt


@router.get("/{debt_id}/history", response_model=list[DebtHistoryOut])
def get_debt_history(
    debt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    debt = _get_owned_debt(db, debt_id, current_user.id)
    return (
        db.query(DebtHistory)
        .filter(DebtHistory.debt_id == debt.id)
        .order_by(DebtHistory.changed_at.asc())
        .all()
    )
