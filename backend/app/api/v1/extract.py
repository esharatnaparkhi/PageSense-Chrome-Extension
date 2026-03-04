"""
Content extraction endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
import httpx

from app.core.security import get_current_user
from app.schemas.schemas import ExtractRequest, ExtractResponse
from app.services.content_extractor import ContentExtractor

router = APIRouter()


def get_extractor():
    return ContentExtractor()


@router.post("/", response_model=ExtractResponse)
async def extract_content(
    request: ExtractRequest,
    _current_user: dict = Depends(get_current_user),
    extractor: ContentExtractor = Depends(get_extractor),
):
    """
    Extract content from a web page or PDF.

    Routing:
      - application/pdf content-type or .pdf URL  → PDF extractor (PyMuPDF)
      - application/xml / text/xml content-type   → JATS XML extractor (PMC)
      - Known research hostname                   → site-specific CSS selectors
      - Everything else                           → Readability + fallback
    """
    raw_bytes: bytes | None = None
    content_type = "text/html"
    html: str | None = request.html

    # Fetch from URL if HTML not provided by the caller (e.g. Chrome extension)
    if not html:
        try:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                ),
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;q=0.9,"
                    "application/pdf,*/*;q=0.8"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            }
            async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
                response = await client.get(request.url, timeout=15.0)
                response.raise_for_status()
                content_type = response.headers.get("content-type", "text/html").lower()
                raw_bytes = response.content
                html = response.text
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch URL: {str(e)}",
            )

    # ── PDF routing ────────────────────────────────────────────────────────────
    is_pdf = "application/pdf" in content_type or request.url.lower().endswith(".pdf")
    if is_pdf:
        if not raw_bytes:
            raise HTTPException(
                status_code=400,
                detail="PDF bytes unavailable. Provide the URL directly (not raw HTML).",
            )
        try:
            result = extractor.extract_from_pdf(raw_bytes, request.url)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")

        return ExtractResponse(
            text_chunks=result["chunks"],
            meta=result["meta"],
            url=request.url,
            title=result.get("title"),
        )

    # ── HTML / XML routing ─────────────────────────────────────────────────────
    # Sensitive-input check only applies to HTML pages (not PDFs / XML feeds)
    sensitive_fields = extractor.detect_sensitive_inputs(html)
    if sensitive_fields:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Page contains sensitive fields: {', '.join(sensitive_fields)}. "
                "Cannot extract content for privacy reasons."
            ),
        )

    try:
        result = extractor.extract_from_html(
            html=html,
            url=request.url,
            include_images=request.include_images,
            content_type=content_type,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Content extraction failed: {str(e)}",
        )

    return ExtractResponse(
        text_chunks=result["chunks"],
        meta=result["meta"],
        url=request.url,
        title=result.get("title"),
    )
