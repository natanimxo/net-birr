import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.login_session import LoginSession, LoginSessionStatus
from app.models.user import User
from app.schemas import LoginInitResponse, LoginPollResponse, SetProfileTypeRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

LOGIN_SESSION_TTL_SECONDS = 5 * 60


@router.post("/telegram/init", response_model=LoginInitResponse)
def init_login(db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc)
    session = LoginSession(
        token=token,
        status=LoginSessionStatus.pending,
        created_at=now,
        expires_at=now + timedelta(seconds=LOGIN_SESSION_TTL_SECONDS),
    )
    db.add(session)
    db.commit()

    deep_link = f"https://t.me/{settings.telegram_bot_username}?start={token}"
    return LoginInitResponse(token=token, deep_link=deep_link, expires_in_seconds=LOGIN_SESSION_TTL_SECONDS)


@router.get("/telegram/poll", response_model=LoginPollResponse)
def poll_login(token: str, db: Session = Depends(get_db)):
    session = db.get(LoginSession, token)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown login token")

    now = datetime.now(timezone.utc)
    if session.status == LoginSessionStatus.pending and session.expires_at < now:
        session.status = LoginSessionStatus.expired
        db.commit()

    if session.status in (LoginSessionStatus.pending,):
        return LoginPollResponse(status="pending")

    if session.status == LoginSessionStatus.expired:
        return LoginPollResponse(status="expired")

    if session.status == LoginSessionStatus.confirmed:
        user = db.get(User, session.user_id)
        is_new_user = user.profile_type is None
        access_token = create_access_token(user.id)
        session.status = LoginSessionStatus.consumed
        db.commit()
        return LoginPollResponse(status="confirmed", access_token=access_token, is_new_user=is_new_user)

    # consumed - token already used
    raise HTTPException(status_code=410, detail="Login token already used")


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/me/profile-type", response_model=UserOut)
def set_profile_type(
    body: SetProfileTypeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.profile_type = body.profile_type
    db.commit()
    db.refresh(current_user)
    return current_user
