from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Infra
    database_url: str = "sqlite+aiosqlite:///./dev.db"

    # Auth
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080

    cors_origins: str = "http://localhost:3000"
    web_base_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"
    storage_dir: str = "./storage"
    platform_domain: str = "vibe.localhost"  # published sites live at <slug>.<platform_domain>
    platform_port: str = "8000"  # shown in dev URLs; leave empty behind a proxy on 80/443
    platform_scheme: str = "http"
    platform_cname: str = "sites.vibe.localhost"  # custom domains point their CNAME here

    # OAuth (optional)
    google_client_id: str | None = None
    google_client_secret: str | None = None
    github_client_id: str | None = None
    github_client_secret: str | None = None

    # AI (optional)
    anthropic_api_key: str | None = None
    ai_provider: str = "ollama"
    # OpenRouter (OpenAI-compatible). When the key is set, OORA and llm.complete use it ahead of Ollama.
    openrouter_api_key: str | None = None
    openrouter_model: str = "z-ai/glm-5.3-flash"
    openrouter_reasoning_effort: str = "low"  # thinking models (GLM 5.3 Flash) otherwise spend the token budget and ~20s thinking; "" = model default
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:3b"
    ollama_agent_model: str = "qwen2.5:14b"  # the builder agent needs a model that is good at tool calling; the 3B one is too weak
    ollama_timeout_seconds: float = 60.0
    intake_use_agent: bool = True
    intake_chat_use_model: bool = True  # the model answers requests and open questions; the built-in reasoning covers the rest and is the fallback  # False = always use the built-in interviewer (no model call)
    intake_agent_timeout: float = 30.0
    agents_ui_model: str = ""  # OpenRouter model for the UI agent only (design quality matters most there); "" = OPENROUTER_MODEL
    agents_auto_build: bool = True  # start the build agents as soon as OORA creates a project (needs a language model)

    # Email (optional). Without SMTP the one-time code is logged to the API console instead.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "VIBE <no-reply@vibe.dev>"
    smtp_starttls: bool = True
    # Local development only: return the code in the API response when email isn't delivered.
    dev_expose_otp: bool = False
    otp_ttl_seconds: int = 600
    otp_max_attempts: int = 5
    otp_resend_seconds: int = 30

    # Billing (optional)
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_id_pro: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host)

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def github_configured(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)

    @property
    def ai_configured(self) -> bool:
        return bool(self.anthropic_api_key) or self.ollama_configured

    @property
    def ollama_configured(self) -> bool:
        return bool(self.ollama_model and self.ollama_base_url)

    @property
    def billing_configured(self) -> bool:
        return bool(self.stripe_secret_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
