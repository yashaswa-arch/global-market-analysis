import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import get_settings
from app.core.exceptions import SupabaseConnectionError, SupabaseQueryError
from app.database.supabase_client import log_supabase_startup
from app.models.schemas import TestDbResponse
from app.routes.database import test_database_connection
from app.routes.router import api_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.scheduler import start_scheduler, stop_scheduler

    log_supabase_startup()
    start_scheduler()
    yield
    stop_scheduler()


def register_exception_handlers(app: FastAPI) -> None:
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

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "healthy", "service": "backend"}

    @app.get("/test-db", response_model=TestDbResponse, tags=["database"])
    async def test_db() -> TestDbResponse:
        return await test_database_connection()

    return app


app = create_app()
