from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    telegram_bot_token: str
    telegram_bot_username: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 30
    free_daily_transaction_cap: int = 5
    environment: str = "development"

    # Comma-separated Telegram user IDs allowed to use the Admin approval endpoints.
    # e.g. "000000000,111111111" - adding a second admin is just an env var change.
    admin_telegram_ids: str = ""

    # Manual payment verification (Ethio Matric-style). Never hardcode real account
    # details in code - these are read from env vars set directly in Railway/‑.env,
    # same as TELEGRAM_BOT_TOKEN. Placeholders here are intentional and user-facing
    # until the real values are set.
    telebirr_number: str = "TODO_FILL_IN"
    telebirr_name: str = "TODO_FILL_IN"
    cbe_account: str = "TODO_FILL_IN"
    awash_account: str = "TODO_FILL_IN"

    price_monthly_birr: int = 200
    price_yearly_birr: int = 2000

    @property
    def admin_telegram_id_set(self) -> set[int]:
        return {int(x) for x in self.admin_telegram_ids.split(",") if x.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
