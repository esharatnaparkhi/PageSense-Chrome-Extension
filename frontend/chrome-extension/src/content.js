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
  // Store current page info
  currentPageInfo = {
    url: window.location.href,
    title: document.title
  };

  // Create widget iframe
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
  widgetIframe.style.background = "white";
  widgetIframe.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.2)";
  widgetIframe.style.setProperty("z-index", "2147483647", "important");
  widgetIframe.style.setProperty("display", "none", "important");
  
  document.body.appendChild(widgetIframe);
  
  // Create floating button
  createFloatingButton();
  
  // Listen for messages from widget
  window.addEventListener('message', handleWidgetMessage);
  
  // Send initial page info when iframe loads
  widgetIframe.addEventListener('load', () => {
    sendPageInfo();
  });
}

function createFloatingButton() {
  const button = document.createElement('button');
  button.id = 'pagesense-floating-button';
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
  button.style.position = "fixed";
  button.style.bottom = "24px";
  button.style.right = "24px";
  button.style.width = "56px";
  button.style.height = "56px";
  button.style.borderRadius = "50%";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
  button.style.color = "white";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.boxShadow = "0 4px 16px rgba(102, 126, 234, 0.4)";
  button.style.transition = "all 0.3s ease";
  button.style.setProperty("z-index", "2147483646", "important");
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 24px rgba(102, 126, 234, 0.6)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
  });
  
  button.addEventListener('click', toggleWidget);
  
  document.body.appendChild(button);
}

function toggleWidget() {
  isWidgetVisible = !isWidgetVisible;
  widgetIframe.style.display = isWidgetVisible ? 'block' : 'none';
  
  if (isWidgetVisible) {
    // Always send current page info when opening
    sendPageInfo();
  }
}

function sendPageInfo() {
  // Update current page info
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
  // Only accept messages from our widget
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

async function extractPageContent() {
  const url = window.location.href;
  const title = document.title;

  const isPDF =
    url.endsWith(".pdf") ||
    document.contentType === "application/pdf";

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: isPDF ? 'EXTRACT_PDF' : 'EXTRACT_CONTENT',
      data: {
        url,
        html: isPDF ? null : document.documentElement.outerHTML
      }
    }, (response) => {
      resolve({
        ...response,
        title,
        url
      });
    });
  });
}

function highlightText(selector) {
  if (!selector) return;
  
  try {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight
      element.style.backgroundColor = 'yellow';
      element.style.transition = 'background-color 2s';
      
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 2000);
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

// Listen for page navigation (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    
    // Update page info when URL changes
    currentPageInfo = {
      url: window.location.href,
      title: document.title
    };
    
    // Send updated page info to widget if it's open
    if (isWidgetVisible) {
      sendPageInfo();
    }
  }
}).observe(document, { subtree: true, childList: true });

// Also listen for title changes
const titleObserver = new MutationObserver(() => {
  if (document.title !== currentPageInfo.title) {
    currentPageInfo.title = document.title;
    if (isWidgetVisible) {
      sendPageInfo();
    }
  }
});

if (document.querySelector('title')) {
  titleObserver.observe(document.querySelector('title'), {
    subtree: true,
    characterData: true,
    childList: true
  });
}