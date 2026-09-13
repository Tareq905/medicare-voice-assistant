from typing import Optional
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # CRM credentials
    crm_base_url: str = "https://your-crm.com/api"
    crm_api_key: Optional[str] = None

    # Timezone
    timezone: str = "Asia/Dhaka"

    # Vapi secret token (for webhook verification, optional but recommended)
    vapi_webhook_secret: Optional[str] = None

    # Vapi Web SDK and Assistant credentials
    vapi_api_key: Optional[str] = None
    vapi_assistant_id: Optional[str] = None
    server_url: Optional[str] = None

    # Admin Portal Credentials
    admin_username: str = "admin"
    admin_password: str = "admin123"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
