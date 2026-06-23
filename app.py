"""
app.py — Standalone upload UI server (FastAPI)
-----------------------------------------------
Serves the single-file upload page at GET /
The browser talks directly to the extraction API — nothing is proxied here.

To run:
    uvicorn app:app --host 0.0.0.0 --port 5000 --reload
"""

import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(title="Document Upload UI")

# Mount static files (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Extraction API base URL — override via environment variable for any environment.
API_BASE = os.environ.get("EXTRACTION_API_BASE", "http://localhost:8000")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    """Serve the upload page."""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"api_base": API_BASE},
    )
