from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.agents.router import router as agents_router
from app.ai.router import router as ai_router
from app.assets.router import router as assets_router
from app.intake.router import router as intake_router
from app.publish.router import router as publish_router
from app.publish.serve import hosting_middleware, router as sites_router
from app.ai.color_advice import router as color_advice_router
from app.auth.otp import router as otp_router
from app.auth.router import router as auth_router
from app.billing.router import router as billing_router
from app.codegen.router import router as codegen_router
from app.core.config import get_settings
from app.github.router import router as github_router
from app.pages.router import router as pages_router
from app.projects.router import router as projects_router

settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app = FastAPI(title="VIBE API", version="0.1.0")


@app.on_event("startup")
async def _warm_model() -> None:
    import asyncio

    from app.ai.providers import warm_up_model

    asyncio.create_task(warm_up_model())
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(hosting_middleware)  # published sites answer on their own addresses
app.mount("/static", StaticFiles(directory=settings.storage_dir, check_dir=False), name="static")

app.include_router(auth_router)
app.include_router(otp_router)
app.include_router(projects_router)
app.include_router(pages_router)
app.include_router(assets_router)
app.include_router(color_advice_router)
app.include_router(intake_router)
app.include_router(ai_router)
app.include_router(agents_router)
app.include_router(codegen_router)
app.include_router(github_router)
app.include_router(billing_router)
app.include_router(publish_router)
app.include_router(sites_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "integrations": {
            "google": settings.google_configured,
            "github": settings.github_configured,
            "ai": settings.ai_configured,
            "billing": settings.billing_configured,
        },
    }
