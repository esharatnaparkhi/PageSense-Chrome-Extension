/**
 * Content Script for PageSense
 * Injects widget iframe and handles page content extraction
 * MULTI-PAGE SUPPORT
 */

let widgetIframe = null;
let isWidgetVisible = false;
let currentPageInfo = null;

// Initialize widget on page load
initializeWidget();

function initializeWidget() {
  currentPageInfo = {
    url: window.location.href,
    title: document.title
  };

  widgetIframe = document.createElement('iframe');
  widgetIframe.id = 'pagesense-widget-iframe';
  widgetIframe.src = chrome.runtime.getURL('widget.html');
  widgetIframe.style.position = "fixed";
  widgetIframe.style.top = "20px";
  widgetIframe.style.right = "20px";
  widgetIframe.style.width = "400px";
  widgetIframe.style.height = "600px";
  widgetIframe.style.border = "none";
  widgetIframe.style.borderRadius = "16px";
  widgetIframe.style.background = "#0B0B0B";
  widgetIframe.style.boxShadow = "0 8px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.06)";
  widgetIframe.style.setProperty("z-index", "2147483647", "important");
  widgetIframe.style.setProperty("display", "none", "important");

  document.body.appendChild(widgetIframe);

  createFloatingButton();

  window.addEventListener('message', handleWidgetMessage);

  widgetIframe.addEventListener('load', () => {
    sendPageInfo();
  });
}

function createFloatingButton() {
  const button = document.createElement('button');
  button.id = 'pagesense-floating-button';
  button.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  button.style.position = "fixed";
  button.style.bottom = "24px";
  button.style.right = "24px";
  button.style.width = "52px";
  button.style.height = "52px";
  button.style.borderRadius = "50%";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.background = "#F7C71F";
  button.style.color = "#0B0B0B";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.boxShadow = "0 4px 20px rgba(247, 199, 31, 0.45)";
  button.style.transition = "transform 0.2s ease, box-shadow 0.2s ease";
  button.style.setProperty("z-index", "2147483646", "important");

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.08)';
    button.style.boxShadow = '0 6px 28px rgba(247, 199, 31, 0.6)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 20px rgba(247, 199, 31, 0.45)';
  });

  button.addEventListener('click', toggleWidget);

  document.body.appendChild(button);
}

function toggleWidget() {
  isWidgetVisible = !isWidgetVisible;
  widgetIframe.style.display = isWidgetVisible ? 'block' : 'none';

  if (isWidgetVisible) {
    sendPageInfo();
  }
}

function sendPageInfo() {
  currentPageInfo = {
    url: window.location.href,
    title: document.title
  };

  if (widgetIframe && widgetIframe.contentWindow) {
    widgetIframe.contentWindow.postMessage({
      type: 'PAGE_INFO',
      data: currentPageInfo
    }, '*');
  }
}

function handleWidgetMessage(event) {
  if (event.source !== widgetIframe.contentWindow) return;

  const { type, data } = event.data;

  if (type === 'EXTRACT_PAGE_CONTENT') {
    extractPageContent().then(content => {
      widgetIframe.contentWindow.postMessage({
        type: 'PAGE_CONTENT_EXTRACTED',
        data: content
      }, '*');
    });
  }

  if (type === 'HIGHLIGHT_TEXT') {
    highlightText(data.selector);
  }

  if (type === 'CLOSE_WIDGET') {
    toggleWidget();
  }
}

/* ===================================================================
   CLIENT-SIDE CONTENT EXTRACTION
   Extracts visible text directly from the DOM — no backend call needed.
   Much faster and captures content readability misses (SPAs, tables, etc.)
=================================================================== */

const _SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT',
  'EMBED', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'HEAD', 'META', 'LINK',
]);

const _SKIP_ROLES = new Set([
  'navigation', 'banner', 'complementary', 'contentinfo',
  'search', 'dialog', 'alertdialog', 'status', 'toolbar',
]);

// Matches class/id names that indicate non-content chrome
const _SKIP_PATTERN = /\b(nav|navbar|navigation|sidebar|cookie|consent|popup|modal|overlay|advertisement|advert|banner|breadcrumb|masthead|toolbar|tooltip|drawer|footer|header|menu|site-header|site-footer)\b/i;

// Elements whose innerText we capture directly (don't recurse into children)
const _BLOCK_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'TD', 'TH', 'DT', 'DD', 'BLOCKQUOTE',
  'PRE', 'FIGCAPTION', 'CAPTION', 'SUMMARY',
]);

function _shouldSkip(el) {
  if (_SKIP_TAGS.has(el.tagName)) return true;

  const role = el.getAttribute && el.getAttribute('role');
  if (role && _SKIP_ROLES.has(role)) return true;

  if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return true;

  const cls = (el.className && typeof el.className === 'string')
    ? el.className.toLowerCase() : '';
  const id = (el.id || '').toLowerCase();
  if (_SKIP_PATTERN.test(cls) || _SKIP_PATTERN.test(id)) return true;

  return false;
}

function _extractParagraphs() {
  // Prefer focused semantic content root; fall back to body
  const root =
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('article') ||
    document.body;

  const paragraphs = [];

  function walk(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (_shouldSkip(node)) return;

    if (_BLOCK_TAGS.has(node.tagName)) {
      // innerText respects CSS visibility; textContent does not
      const text = (node.innerText || node.textContent || '').trim();
      if (text.length > 30) {
        paragraphs.push(text);
      }
      // Don't recurse — innerText already includes all descendants
      return;
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);

  // Deduplicate repeated snippets (e.g. repeated nav labels leaked in)
  const seen = new Set();
  return paragraphs.filter(p => {
    const key = p.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function _buildChunks(paragraphs, sourceUrl, chunkSize = 900, overlap = 120) {
  const chunks = [];
  let buffer = '';
  let charOffset = 0;
  let idx = 0;

  function flush() {
    const text = buffer.trim();
    if (text.length > 40) {
      chunks.push({
        id: String(idx++),
        text,
        start_char: charOffset,
        end_char: charOffset + text.length,
        dom_selector: null,
        source_url: sourceUrl,
      });
    }
  }

  for (const para of paragraphs) {
    if (buffer.length + para.length + 2 > chunkSize && buffer.length > 0) {
      flush();
      charOffset += buffer.length;
      buffer = buffer.slice(-overlap) + '\n\n' + para;
    } else {
      buffer = buffer ? buffer + '\n\n' + para : para;
    }
  }

  flush();
  return chunks;
}

async function extractPageContent() {
  const url = window.location.href;
  const title = document.title;

  // PDFs can't be DOM-extracted — delegate to background/backend
  if (url.endsWith('.pdf') || document.contentType === 'application/pdf') {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXTRACT_PDF', data: { url } },
        (response) => resolve({ ...response, title, url })
      );
    });
  }

  // Synchronous client-side extraction — zero network latency
  const paragraphs = _extractParagraphs();
  const text_chunks = _buildChunks(paragraphs, url);

  return { text_chunks, title, url };
}

function highlightText(selector) {
  if (!selector) return;
  try {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.backgroundColor = 'rgba(247, 199, 31, 0.25)';
      element.style.transition = 'background-color 2s';
      setTimeout(() => { element.style.backgroundColor = ''; }, 2500);
    }
  } catch (error) {
    console.error('Failed to highlight text:', error);
  }
}

// Listen for extension icon click
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_WIDGET') {
    toggleWidget();
  }
});

// Listen for page navigation (SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    currentPageInfo = { url: window.location.href, title: document.title };
    if (isWidgetVisible) sendPageInfo();
  }
}).observe(document, { subtree: true, childList: true });

// Listen for title changes
const titleObserver = new MutationObserver(() => {
  if (document.title !== currentPageInfo.title) {
    currentPageInfo.title = document.title;
    if (isWidgetVisible) sendPageInfo();
  }
});

if (document.querySelector('title')) {
  titleObserver.observe(document.querySelector('title'), {
    subtree: true,
    characterData: true,
    childList: true
  });
}
