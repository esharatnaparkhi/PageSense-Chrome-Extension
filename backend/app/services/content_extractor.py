"""
Content extraction service using readability and beautifulsoup
"""
import re
import hashlib
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from readability import Document
import html2text

from app.schemas.schemas import TextChunk


class ContentExtractor:
    """Extract and process web page content"""
    
    def __init__(self):
        self.html2text = html2text.HTML2Text()
        self.html2text.ignore_links = False
        self.html2text.ignore_images = True
        self.html2text.body_width = 0
        
        # Sensitive field patterns
        self.sensitive_patterns = {
            'credit_card': re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
            'ssn': re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
            'email': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
        }
    
    def extract_from_html(
        self,
        html: str,
        url: str,
        include_images: bool = False,
    ) -> Dict[str, Any]:
        """Extract content from HTML"""
        
        # Use readability to extract main content
        doc = Document(html)
        title = doc.title()
        summary_html = doc.summary()
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(summary_html, 'lxml')
        
        # Remove script and style tags
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()
        
        # Extract text
        text = self.html2text.handle(str(soup))
        
        # Clean text
        text = self._clean_text(text)
        
        # Redact sensitive information
        text = self._redact_sensitive(text)
        
        # Create chunks
        chunks = self._create_chunks(text, url)
        
        # Extract metadata
        meta = self._extract_metadata(soup, url)
        
        return {
            'text': text,
            'chunks': chunks,
            'meta': meta,
            'title': title,
        }
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove excessive whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = re.sub(r' +', ' ', text)
        text = text.strip()
        return text
    
    def _redact_sensitive(self, text: str) -> str:
        """Redact sensitive information"""
        for pattern_name, pattern in self.sensitive_patterns.items():
            text = pattern.sub(f'[REDACTED_{pattern_name.upper()}]', text)
        return text
    
    def _create_chunks(
        self,
        text: str,
        url: str,
        chunk_size: int = 1000,
        overlap: int = 200,
    ) -> List[TextChunk]:
        """Split text into overlapping chunks"""
        chunks = []
        text_length = len(text)
        start = 0
        chunk_index = 0
        
        while start < text_length:
            end = min(start + chunk_size, text_length)
            
            # Try to break at sentence boundary
            if end < text_length:
                # Look for period, question mark, or exclamation
                for i in range(end, max(start + chunk_size - 200, start), -1):
                    if text[i] in '.!?':
                        end = i + 1
                        break
            
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunk_id = hashlib.md5(
                    f"{url}:{chunk_index}".encode()
                ).hexdigest()[:16]
                
                chunks.append(TextChunk(
                    id=chunk_id,
                    text=chunk_text,
                    start_char=start,
                    end_char=end,
                    dom_selector=None,  # Could be enhanced with actual selectors
                ))
                chunk_index += 1
            
            start = end - overlap if end < text_length else end
        
        return chunks
    
    def _extract_metadata(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract page metadata"""
        meta = {
            'url': url,
            'word_count': 0,
            'headings': [],
            'links': [],
        }
        
        # Count words
        text = soup.get_text()
        meta['word_count'] = len(text.split())
        
        # Extract headings
        for heading in soup.find_all(['h1', 'h2', 'h3']):
            meta['headings'].append({
                'level': heading.name,
                'text': heading.get_text().strip(),
            })
        
        # Extract links (first 20)
        for link in soup.find_all('a', href=True)[:20]:
            meta['links'].append({
                'text': link.get_text().strip(),
                'href': link['href'],
            })
        
        return meta
    
    def detect_sensitive_inputs(self, html: str) -> List[str]:
        """Detect sensitive input fields in HTML"""
        soup = BeautifulSoup(html, 'lxml')
        sensitive_fields = []
        
        # Look for password inputs
        for input_tag in soup.find_all('input', type='password'):
            sensitive_fields.append('password')
        
        # Look for credit card patterns
        for input_tag in soup.find_all('input'):
            name = (input_tag.get('name', '') + ' ' + input_tag.get('id', '')).lower()
            if any(keyword in name for keyword in ['card', 'cvv', 'ccv', 'credit']):
                sensitive_fields.append('credit_card')
        
        return list(set(sensitive_fields))