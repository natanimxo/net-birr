import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_admin_user
from app.database import get_db
from app.models.payment_submission import PaymentPlan, PaymentSubmission, PaymentSubmissionStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas import PaymentSubmissionOut, RejectSubmissionRequest

router = APIRouter(prefix="/admin/payments", tags=["admin"])

PLAN_DURATIONS = {
    PaymentPlan.monthly: timedelta(days=30),
    PaymentPlan.yearly: timedelta(days=365),
}


@router.get("/submissions", response_model=list[PaymentSubmissionOut])
def list_submissions(
    status_filter: PaymentSubmissionStatus | None = Query(default=PaymentSubmissionStatus.pending, alias="status"),
    _: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(PaymentSubmission)
    if status_filter is not None:
        query = query.filter(PaymentSubmission.status == status_filter)
    return query.order_by(PaymentSubmission.submitted_at.asc()).all()


def _get_pending_submission(db: Session, submission_id: uuid.UUID, current_admin: User) -> PaymentSubmission:
    submission = db.get(PaymentSubmission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status != PaymentSubmissionStatus.pending:
        raise HTTPException(status_code=409, detail=f"Submission already {submission.status.value}")
    # Separation-of-duties: an admin can't review their own submission. In the
    # sole-owner case this shouldn't come up in practice since admins already
    # bypass the paywall (see _is_free_tier in transactions.py), but this guard
    # matters once there's more than one admin.
    if submission.user_id == current_admin.id:
        raise HTTPException(status_code=403, detail="You cannot review your own payment submission")
    return submission


@router.post("/submissions/{submission_id}/approve", response_model=PaymentSubmissionOut)
def approve_submission(
    submission_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    submission = _get_pending_submission(db, submission_id, current_admin)
    now = datetime.now(timezone.utc)

    submission.status = PaymentSubmissionStatus.approved
    submission.reviewed_at = now

    subscription = db.query(Subscription).filter(Subscription.user_id == submission.user_id).one_or_none()
    if subscription is None:
        subscription = Subscription(user_id=submission.user_id)
        db.add(subscription)

    # Extend from the current active_until if it's still in the future (renewal),
    # otherwise start the new period from now (lapsed or first-time subscriber).
    duration = PLAN_DURATIONS[submission.plan]
    start_from = subscription.active_until if (subscription.active_until and subscription.active_until > now) else now
    subscription.status = SubscriptionStatus.active
    subscription.active_until = start_from + duration

    db.commit()
    db.refresh(submission)

    return submission


@router.post("/submissions/{submission_id}/reject", response_model=PaymentSubmissionOut)
def reject_submission(
    submission_id: uuid.UUID,
    body: RejectSubmissionRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    submission = _get_pending_submission(db, submission_id, current_admin)
    submission.status = PaymentSubmissionStatus.rejected
    submission.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(submission)

    return submission
