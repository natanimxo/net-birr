import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.bot import build_bot_application
from app.database import SessionLocal
from app.routers import accounts, admin, auth, categories, debts, payments, transactions
from app.seed import seed_default_categories

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed default categories on boot.
    db = SessionLocal()
    try:
        seed_default_categories(db)
    finally:
        db.close()

    # Run the Telegram bot (long polling) alongside the API for local dev.
    # Production on Railway should switch this to webhook mode.
    bot_app = build_bot_application()
    await bot_app.initialize()
    await bot_app.start()
    await bot_app.updater.start_polling()
    logger.info("Telegram bot polling started")

    try:
        yield
    finally:
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()


app = FastAPI(title="Finance App API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(debts.router)
app.include_router(payments.router)
app.include_router(admin.router)

# Serves uploaded payment-proof screenshots. NOTE: Railway's filesystem is ephemeral -
# this is fine for local dev but production should move to object storage (e.g. S3)
# before this matters at scale; flagged here rather than silently assumed permanent.
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
