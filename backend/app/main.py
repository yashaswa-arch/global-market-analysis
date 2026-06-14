import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config.settings import get_settings
from app.core.exceptions import SupabaseConnectionError, SupabaseQueryError
from app.database.supabase_client import log_supabase_startup
from app.models.schemas import TestDbResponse
from app.routes.database import test_database_connection
from app.routes.router import api_router

logger = logging.getLogger(__name__)


def _rate_limit_key(request: Request) -> str:
    """Key rate limits by authenticated user id when available, else by remote IP.

    This prevents a single user from exhausting limits across different IPs
    and avoids punishing other users when one IP is shared (e.g. NAT/proxy).
    """
    user = getattr(request.state, "user", None)
    if isinstance(user, dict) and user.get("id"):
        return f"user:{user['id']}"
    return get_remote_address(request)


# Global limiter instance — imported by route modules via app.state.limiter
limiter = Limiter(key_func=_rate_limit_key, default_limits=[])


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.scheduler import start_scheduler, stop_scheduler

    log_supabase_startup()
    start_scheduler()
    yield
    stop_scheduler()


def register_exception_handlers(app: FastAPI) -> None:
    # Rate limit exceeded — return a clean JSON 429
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.exception_handler(SupabaseConnectionError)
    async def supabase_connection_handler(
        _request: Request, exc: SupabaseConnectionError
    ) -> JSONResponse:
        logger.error("Supabase connection error: %s", exc.message)
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "supabase_connection_error",
                    "message": exc.message,
                }
            },
        )

    @app.exception_handler(SupabaseQueryError)
    async def supabase_query_handler(_request: Request, exc: SupabaseQueryError) -> JSONResponse:
        logger.error("Supabase query error: %s", exc.message)
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "supabase_query_error",
                    "message": exc.message,
                    "table": exc.table,
                }
            },
        )


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_prefix)

    # Attach rate limiter to app state so route decorators can reference it
    app.state.limiter = limiter

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "service": "backend"}

    @app.get("/test-db", response_model=TestDbResponse, tags=["database"])
    async def test_db() -> TestDbResponse:
        return await test_database_connection()

    return app


app = create_app()
