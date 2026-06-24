"""
app.py — Standalone upload UI server (FastAPI)
-----------------------------------------------
Serves the single-file upload page at GET /
The browser talks directly to the extraction API — nothing is proxied here.

To run:
    uvicorn app:app --host 0.0.0.0 --port 5000 --reload
"""

import os

import httpx
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(title="Document Upload UI")

# Mount static files (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Extraction API base URL — override via environment variable for any environment.
API_BASE = os.environ.get("EXTRACTION_API_BASE", "http://localhost:8000")
EXTRACTION_ENDPOINT = f"{API_BASE.rstrip('/')}/extract/single"


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    """Serve the upload page."""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={},
    )


@app.post("/extract/single")
async def proxy_extract_single(file: UploadFile = File(...)) -> JSONResponse:
    """Receive the browser upload and forward it to FileReader server-side."""
    try:
        file_bytes = await file.read()
        files = {
            "file": (
                file.filename or "uploaded_file.pdf",
                file_bytes,
                file.content_type or "application/pdf",
            )
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            upstream = await client.post(EXTRACTION_ENDPOINT, files=files)

        try:
            content = upstream.json()
        except ValueError:
            content = {
                "success": False,
                "message": "Extraction server returned an invalid response.",
            }

        return JSONResponse(status_code=upstream.status_code, content=content)

    except httpx.RequestError:
        return JSONResponse(
            status_code=502,
            content={
                "success": False,
                "message": "Could not reach the extraction server. Please try again.",
            },
        )
    finally:
        await file.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=False)
