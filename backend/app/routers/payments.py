import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.payment_submission import PaymentPlan, PaymentSubmission, PaymentSubmissionStatus
from app.models.user import User
from app.schemas import (
    PaymentAccountDetails,
    PaymentSubmissionCreate,
    PaymentSubmissionOut,
    PlansResponse,
    UploadResponse,
)

router = APIRouter(prefix="/payments", tags=["payments"])
settings = get_settings()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "screenshots"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB


def _price_for_plan(plan: PaymentPlan) -> float:
    return settings.price_monthly_birr if plan == PaymentPlan.monthly else settings.price_yearly_birr


@router.get("/plans", response_model=PlansResponse)
def get_plans(_: User = Depends(get_current_user)):
    return PlansResponse(
        price_monthly_birr=settings.price_monthly_birr,
        price_yearly_birr=settings.price_yearly_birr,
        payment_details=PaymentAccountDetails(
            telebirr_number=settings.telebirr_number,
            telebirr_name=settings.telebirr_name,
            cbe_account=settings.cbe_account,
            awash_account=settings.awash_account,
        ),
    )


@router.post("/upload-screenshot", response_model=UploadResponse)
async def upload_screenshot(file: UploadFile, current_user: User = Depends(get_current_user)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are accepted")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large (max 8MB)")

    extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[file.content_type]
    filename = f"{current_user.id}_{uuid.uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(contents)

    return UploadResponse(url=f"/uploads/screenshots/{filename}")


@router.post("/submissions", response_model=PaymentSubmissionOut, status_code=201)
def create_submission(
    body: PaymentSubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = PaymentSubmission(
        user_id=current_user.id,
        plan=body.plan,
        amount=_price_for_plan(body.plan),
        method=body.method,
        sender_name=body.sender_name,
        transaction_id=body.transaction_id,
        screenshot_url=body.screenshot_url,
        status=PaymentSubmissionStatus.pending,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    return submission


@router.get("/submissions/me", response_model=list[PaymentSubmissionOut])
def list_my_submissions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(PaymentSubmission)
        .filter(PaymentSubmission.user_id == current_user.id)
        .order_by(PaymentSubmission.submitted_at.desc())
        .all()
    )
