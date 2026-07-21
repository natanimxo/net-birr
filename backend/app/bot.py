import logging
from datetime import datetime, timezone

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from app.config import get_settings
from app.database import SessionLocal
from app.models.account import Account, AccountType
from app.models.login_session import LoginSession, LoginSessionStatus
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_or_create_user(db, telegram_user) -> User:
    user = db.query(User).filter(User.telegram_id == telegram_user.id).one_or_none()
    if user is not None:
        return user

    user = User(
        telegram_id=telegram_user.id,
        telegram_username=telegram_user.username,
        first_name=telegram_user.first_name,
    )
    db.add(user)
    db.flush()  # get user.id before creating dependents

    db.add(Account(user_id=user.id, name="Cash", type=AccountType.cash, is_default=True))
    db.add(Subscription(user_id=user.id))
    return user


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args
    chat = update.effective_chat
    telegram_user = update.effective_user

    if not args:
        await context.bot.send_message(
            chat_id=chat.id,
            text="Open the app and tap 'Login with Telegram' to get a login link - this bot only handles sign-in.",
        )
        return

    token = args[0]
    db = SessionLocal()
    try:
        session = db.get(LoginSession, token)
        now = datetime.now(timezone.utc)

        if session is None or session.status != LoginSessionStatus.pending:
            await context.bot.send_message(chat_id=chat.id, text="This login link is invalid. Please try again from the app.")
            return

        if session.expires_at < now:
            session.status = LoginSessionStatus.expired
            db.commit()
            await context.bot.send_message(chat_id=chat.id, text="This login link expired. Please request a new one from the app.")
            return

        user = _get_or_create_user(db, telegram_user)
        session.status = LoginSessionStatus.confirmed
        session.user_id = user.id
        db.commit()

        await context.bot.send_message(chat_id=chat.id, text="You're logged in. Go back to the app to continue.")
    finally:
        db.close()


def build_bot_application() -> Application:
    application = Application.builder().token(settings.telegram_bot_token).build()
    application.add_handler(CommandHandler("start", start))
    return application
