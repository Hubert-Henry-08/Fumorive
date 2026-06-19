"""
Downloads Router
Serves downloadable files (e.g., EEG Server Package).

Primary download: GitHub Releases direct link (served by frontend).
Fallback: This backend route serves the local file, or redirects to GitHub if not found.
"""

import os
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse

logger = logging.getLogger("fumorive")

router = APIRouter(prefix="/downloads", tags=["Downloads"])

from pathlib import Path

# Base directory of the backend (same level as app)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent

# Path where files are stored (either from env var or static folder)
DOWNLOADS_DIR = os.environ.get(
    "DOWNLOADS_DIR", 
    str(BACKEND_DIR / "static" / "downloads")
)

EEG_PACKAGE_FILENAME = "fumorive-eeg-server.zip"

# GitHub Releases direct download URL (always points to latest release)
GITHUB_EEG_DOWNLOAD_URL = (
    "https://github.com/Apypz/Fumorive/releases/download/v1.0.0/fumorive-eeg-server.zip"
)


@router.get("/eeg-package", summary="Download EEG Server Package")
async def download_eeg_package():
    """
    Download the Fumorive EEG Server Package (.zip).
    Contains everything needed to stream Muse 2 EEG data to the backend.

    - If the file exists locally, serves it directly.
    - Otherwise, redirects to the GitHub Releases direct download URL.
    """
    file_path = os.path.join(DOWNLOADS_DIR, EEG_PACKAGE_FILENAME)

    if os.path.exists(file_path):
        return FileResponse(
            path=file_path,
            filename=EEG_PACKAGE_FILENAME,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={EEG_PACKAGE_FILENAME}"
            }
        )

    # Fallback: redirect to GitHub Releases
    logger.info(
        f"EEG package not found locally at: {file_path}. "
        f"Redirecting to GitHub Releases."
    )
    return RedirectResponse(url=GITHUB_EEG_DOWNLOAD_URL, status_code=302)


@router.get("/eeg-package/info", summary="EEG Package Info")
async def eeg_package_info():
    """Check if EEG package is available and get its size."""
    file_path = os.path.join(DOWNLOADS_DIR, EEG_PACKAGE_FILENAME)
    exists = os.path.exists(file_path)
    size_kb = round(os.path.getsize(file_path) / 1024, 1) if exists else None

    return {
        "available": exists,
        "filename": EEG_PACKAGE_FILENAME,
        "size_kb": size_kb,
        "download_url": "/api/v1/downloads/eeg-package",
        "github_url": GITHUB_EEG_DOWNLOAD_URL,
    }
