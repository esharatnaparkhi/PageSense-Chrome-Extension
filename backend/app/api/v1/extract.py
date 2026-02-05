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
    current_user: dict = Depends(get_current_user),
    extractor: ContentExtractor = Depends(get_extractor),
):
    """Extract content from a web page"""
    html = request.html
    
    # If HTML not provided, fetch from URL
    if not html:
        try:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
            async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
                response = await client.get(request.url, timeout=15.0)
                response.raise_for_status()
                html = response.text
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch URL: {str(e)}"
            )
    
    # Check for sensitive inputs
    sensitive_fields = extractor.detect_sensitive_inputs(html)
    if sensitive_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Page contains sensitive fields: {', '.join(sensitive_fields)}. "
                   "Cannot extract content for privacy reasons."
        )
    
    # Extract content
    try:
        result = extractor.extract_from_html(
            html=html,
            url=request.url,
            include_images=request.include_images,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Content extraction failed: {str(e)}"
        )
    
    return ExtractResponse(
        text_chunks=result['chunks'],
        meta=result['meta'],
        url=request.url,
        title=result.get('title'),
    )