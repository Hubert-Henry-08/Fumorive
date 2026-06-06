"""
Security Headers Middleware
Adds OWASP-recommended HTTP security headers to every response.
Week 6, Tuesday - Security Headers
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Injects the following headers on every HTTP response:

    Header                          Value / Purpose
    ------------------------------- ------------------------------------------
    X-Content-Type-Options          nosniff   — prevent MIME-type sniffing
    X-Frame-Options                 DENY      — prevent clickjacking
    X-XSS-Protection                0         — let browser's XSS auditor off;
                                               modern browsers use CSP instead
    Referrer-Policy                 strict-origin-when-cross-origin
    Permissions-Policy              disable camera/mic/geolocation via JS API
    Content-Security-Policy         tight policy; relaxed for /api/docs (Swagger)
    Strict-Transport-Security       1 year HSTS (only meaningful over HTTPS)
    Cache-Control                   no-store for API responses (no sensitive caching)
    """

    # Endpoints that render Swagger/ReDoc UI — need looser CSP to load CDN assets
    _DOCS_PATHS = {"/api/docs", "/api/redoc", "/openapi.json"}

    # CSP for regular API responses (no UI assets needed)
    _CSP_API = (
        "default-src 'none'; "
        "frame-ancestors 'none';"
    )

    # Relaxed CSP for Swagger / ReDoc pages
    _CSP_DOCS = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://fastapi.tiangolo.com; "
        "font-src 'self' https://cdn.jsdelivr.net; "
        "frame-ancestors 'none';"
    )

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        # Skip security headers for CORS preflight requests — let
        # CORSMiddleware handle OPTIONS responses without interference.
        if request.method == "OPTIONS":
            return response

        is_docs = request.url.path in self._DOCS_PATHS

        response.headers["X-Content-Type-Options"]  = "nosniff"
        response.headers["X-Frame-Options"]          = "DENY"
        response.headers["X-XSS-Protection"]         = "0"
        response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]        = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        response.headers["Content-Security-Policy"]  = (
            self._CSP_DOCS if is_docs else self._CSP_API
        )
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

        # Prevent caching of API responses that may contain sensitive data
        if not is_docs and not request.url.path.startswith("/metrics"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"]        = "no-cache"

        return response
