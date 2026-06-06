"""
FastAPI Backend Application
Main application entry point with all routes and middleware
"""

import re
import time
import uuid
import logging
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.redis import init_redis, close_redis
from app.core.firebase import init_firebase
from app.core.error_handlers import register_exception_handlers
from app.core.rate_limiter import limiter, rate_limit_exceeded_handler
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.metrics import app_metrics
from app.api.routes.auth import router as auth_router
from app.api.routes.sessions import router as sessions_router
from app.api.routes.websocket import router as websocket_router
from app.api.routes.eeg import router as eeg_router
from app.api.routes.face import router as face_router
from app.api.routes.users import router as users_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.playback import router as playback_router
from app.api.routes.export import router as export_router
from app.api.routes.health import router as health_router
from app.api.routes.reporting import router as reporting_router
from app.api.routes.downloads import router as downloads_router


# ============================================
# STRUCTURED JSON LOGGING
# ============================================

class _JsonFormatter(logging.Formatter):
    """
    Emit each log record as a single JSON line.
    Includes all fields from the `extra` dict passed to logger calls.
    """
    def format(self, record: logging.LogRecord) -> str:
        base = {
            "time":    self.formatTime(record, self.datefmt),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }
        # Merge any extra fields (request_id, path, etc.)
        skip = {
            "name", "msg", "args", "levelname", "levelno", "pathname",
            "filename", "module", "exc_info", "exc_text", "stack_info",
            "lineno", "funcName", "created", "msecs", "relativeCreated",
            "thread", "threadName", "processName", "process", "taskName",
        }
        for key, val in record.__dict__.items():
            if key not in skip:
                base[key] = val
        if record.exc_info:
            base["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(base, default=str, ensure_ascii=False)


def _configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())

    # Root logger — catches everything
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if getattr(settings, "DEBUG", False) else logging.INFO)

    # Quieten noisy third-party loggers
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


_configure_logging()
logger = logging.getLogger("fumorive")

# Create FastAPI app instance with enhanced metadata
app = FastAPI(
    title="Fumorive API",
    version="1.0.0",
    description="""
## Fumorive - Driving Simulator with EEG & Face Recognition

Real-time fatigue detection system using:
- **EEG signals** (Muse 2 headband)
- **Face recognition** (MediaPipe)
- **Driving simulation** (Babylon.js)

### Features
- [AUTH] JWT Authentication with Redis token blacklist
- [DATA] Real-time EEG data streaming via WebSocket
- 😴 Multimodal fatigue detection
- [CHART] TimescaleDB for time-series data storage
- [GAME] Interactive driving simulator

### Documentation
- **API Docs**: [Swagger UI](/api/docs)
- **Alternative**: [ReDoc](/api/redoc)
    """,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    contact={
        "name": "Fumorive Team",
    },
    license_info={
        "name": "MIT License",
    },
    openapi_tags=[
        {
            "name": "Authentication",
            "description": "User authentication endpoints (register, login, logout, refresh)"
        },
        {
            "name": "Users",
            "description": "User profile management"
        },
        {
            "name": "Sessions",
            "description": "Driving session management (CRUD operations)"
        },
        {
            "name": "WebSocket",
            "description": "Real-time data streaming endpoints"
        },
        {
            "name": "Reports",
            "description": "Aggregated analytics and reporting"
        },
        {
            "name": "Health",
            "description": "System health and monitoring endpoints (liveness, readiness, metrics)"
        },
        {
            "name": "EEG Data",
            "description": "EEG data ingestion from Python LSL middleware (stream & batch)"
        },
        {
            "name": "Alerts",
            "description": "Fatigue alert management (create, list, acknowledge)"
        },
        {
            "name": "Face Detection",
            "description": "Face recognition events from MediaPipe"
        },
        {
            "name": "Export",
            "description": "Session data export (CSV, JSON, XDF)"
        },
        {
            "name": "Playback",
            "description": "Session recording playback and timeline retrieval"
        },
    ]
)

# ============================================
# RATE LIMITER STATE
# Must be set BEFORE adding middleware/routes
# ============================================
from slowapi.errors import RateLimitExceeded  # noqa: E402

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# ============================================
# MIDDLEWARE CONFIGURATION
# ============================================
# Note: FastAPI processes middleware in REVERSE order of registration
# So we add CORS LAST to ensure it's processed FIRST

# 1. Security Headers Middleware (processed last in chain = outermost wrapper)
app.add_middleware(SecurityHeadersMiddleware)

# 2. GZip Compression Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)


# 2. Request Logging & Timing Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Attach a unique request ID to every request; log method, path,
    status code, and wall-clock duration as a structured JSON line.
    """
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    # Make request ID available to handlers and error formatters
    request.state.request_id = request_id

    response = await call_next(request)

    duration_ms = (time.time() - start_time) * 1000
    duration_s  = duration_ms / 1000

    # Normalise path for metrics grouping (strip UUIDs and numeric IDs)
    norm_path = re.sub(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        "{id}", request.url.path
    )
    norm_path = re.sub(r"/\d+", "/{id}", norm_path)

    # Record in-process metrics
    app_metrics.record(duration_s, response.status_code, norm_path)

    log_level = logging.WARNING if duration_ms > 500 else logging.INFO
    logger.log(
        log_level,
        "request",
        extra={
            "request_id":  request_id,
            "method":      request.method,
            "path":        request.url.path,
            "status":      response.status_code,
            "duration_ms": round(duration_ms, 2),
            "client":      request.client.host if request.client else None,
            "slow":        duration_ms > 500,
        },
    )

    response.headers["X-Request-ID"]   = request_id
    response.headers["X-Process-Time"] = f"{duration_s:.3f}"
    return response


# 3. CORS Middleware (added LAST = processed FIRST!)
# This must come after all @app.middleware decorators
# Note: Cannot use ["*"] with allow_credentials=True
#
# allow_origin_regex matches all Vercel preview / branch deploy URLs
# so you don't have to list every preview URL manually.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://fumorive(-[a-z0-9-]+)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)

logger.info(
    "CORS configured",
    extra={
        "explicit_origins": settings.CORS_ORIGINS,
        "origin_regex": r"https://fumorive(-[a-z0-9-]+)?\.vercel\.app",
    },
)


# Include API routers
API_V1_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_V1_PREFIX)
app.include_router(users_router, prefix=API_V1_PREFIX)
app.include_router(sessions_router, prefix=API_V1_PREFIX)
app.include_router(websocket_router, prefix=API_V1_PREFIX)
app.include_router(eeg_router, prefix=API_V1_PREFIX)
app.include_router(face_router, prefix=API_V1_PREFIX)
app.include_router(alerts_router, prefix=API_V1_PREFIX)
app.include_router(playback_router, prefix=API_V1_PREFIX)
app.include_router(export_router, prefix=API_V1_PREFIX)
app.include_router(health_router)  # No prefix — /health/* must be at root for Railway health check
app.include_router(reporting_router, prefix=API_V1_PREFIX)
app.include_router(downloads_router, prefix=API_V1_PREFIX)

# Register global exception handlers (after routers so they don't shadow 404s)
register_exception_handlers(app)

# ============================================
# PROMETHEUS METRICS
# ============================================
try:
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        # Exclude health/metrics endpoints from latency histograms
        excluded_handlers=["/health", "/health/live", "/health/ready", "/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    logger.info("Prometheus metrics enabled", extra={"endpoint": "/metrics"})
except ImportError:
    logger.warning("prometheus-fastapi-instrumentator not installed — metrics disabled")

# ============================================
# HEALTH CHECK ENDPOINTS
# ============================================

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - API status"""
    return {
        "name": "Fumorive Backend API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/api/docs"
    }


@app.get("/api/v1/info", tags=["Health"])
async def api_info():
    """API information endpoint"""
    return {
        "name": "Fumorive API",
        "version": "1.0.0",
        "endpoints": {
            "auth": f"{API_V1_PREFIX}/auth",
            "sessions": f"{API_V1_PREFIX}/sessions",
            "websocket": f"{API_V1_PREFIX}/ws"
        },
        "documentation": {
            "swagger": "/api/docs",
            "redoc": "/api/redoc"
        }
    }


# Startup event
@app.on_event("startup")
async def startup_event():
    """Execute on application startup"""
    print("=" * 60)
    print("[START] Fumorive Backend API Starting...")
    print(f"[ENV] Environment: {settings.ENVIRONMENT}")
    print(f"[CORS] Origins: {settings.CORS_ORIGINS}")
    import os
    resend_key = os.environ.get("RESEND_API_KEY", "")
    print(f"[EMAIL] RESEND_API_KEY set: {bool(resend_key)} (len={len(resend_key)})")

    # Initialize Redis
    print("\n[REDIS] Initializing Redis...")
    init_redis()

    # Initialize Firebase (OAuth)
    print("\n[FIREBASE] Initializing Firebase...")
    init_firebase()

    # Start EEG data buffer
    print("\n[EEG] Starting EEG data buffer...")
    try:
        from app.core.eeg_relay import start_eeg_buffer
        await start_eeg_buffer()
        print("[EEG] Buffer started successfully")
    except Exception as e:
        print(f"[EEG] Failed to start EEG buffer: {e}")

    print(f"\n[DOCS] Documentation: /api/docs")
    print(f"[WS]   WebSocket: /api/v1/ws/session/{{session_id}}")
    print("=" * 60)


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Execute on application shutdown"""
    print("=" * 60)
    print("[STOP] Fumorive Backend API Shutting Down...")

    # Stop EEG data buffer and flush remaining data
    print("\n[EEG] Stopping EEG data buffer...")
    try:
        from app.core.eeg_relay import stop_eeg_buffer
        await stop_eeg_buffer()
        print("[EEG] Buffer stopped and flushed")
    except Exception as e:
        print(f"[EEG] Failed to stop EEG buffer: {e}")

    # Close Redis connection
    print("\n[REDIS] Closing Redis connection...")
    close_redis()

    print("=" * 60)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )