/**
 * Background Service Worker for PageSense
 * Handles API communication and extension coordination
 * FULL MULTI-CHAT MULTI-PAGE SUPPORT
 */

const API_HOST = "http://127.0.0.1:8000";
const API_BASE_URL = `${API_HOST}/api/v1`;

/* GLOBAL SESSION (shared across tabs) */
let globalSession = {
  currentChatId: null,
  chatSummaries: {}, // { chatId: [{ pageUrl, pageTitle, summary, timestamp }] }
  chatMessages: {}, // { chatId: [{ role, content, pageUrl, pageTitle }] }
  pageChunks: {} // { pageUrl: chunks[] }
};

console.log("[INIT] Background worker started");
console.log("[INIT] API BASE:", API_BASE_URL);

/* ============================================================
   MESSAGE LISTENER
============================================================ */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  console.log("[MSG] Received message:", request.type);

  /* ---------------- GOOGLE LOGIN ---------------- */
  if (request.type === "GOOGLE_LOGIN") {
    console.log("[AUTH] Starting Google OAuth flow...");

    googleSignIn()
      .then(async (idToken) => {
        console.log("[AUTH] Google ID Token received:", idToken?.slice(0, 25));

        const url = `${API_BASE_URL}/auth/google`;
        console.log("[AUTH] Sending token to backend:", url);

        try {
          console.log("[AUTH] Initiating fetch request...");

          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: idToken })
          });

          console.log("[AUTH] Response status:", res.status);

          const raw = await res.text();
          console.log("[AUTH] Raw backend response:", raw);

          if (!res.ok) {
            throw new Error("Backend Google auth failed");
          }

          const data = JSON.parse(raw);

          console.log("[AUTH] JWT received:", data.access_token?.slice(0, 20));

          await chrome.storage.local.set({
            authToken: data.access_token
          });

          console.log("[AUTH] Token stored successfully");

          sendResponse({ success: true });

        } catch (err) {
          console.error("[AUTH] FETCH ERROR:", err);
          sendResponse({ error: err.toString() });
        }

      })
      .catch((err) => {
        console.error("[AUTH] GOOGLE SIGNIN FAILED:", err);
        sendResponse({ error: err.toString() });
      });

    return true; // KEEP CHANNEL OPEN
  }

  /* ---------------- SESSION GET ---------------- */
  if (request.type === "GET_SESSION") {
    console.log("[SESSION] Returning session:", globalSession);
    sendResponse(globalSession);
    return;
  }

  /* ---------------- SESSION SET ---------------- */
  if (request.type === "SET_SESSION") {
    console.log("[SESSION] Updating session:", request.data);
    globalSession = {
      ...globalSession,
      ...request.data
    };
    
    // Persist to storage
    chrome.storage.local.set({ globalSession });
    
    sendResponse({ ok: true });
    return;
  }

  /* ---------------- GENERIC API CALL ---------------- */
  if (request.type === "API_CALL") {
    apiRequest(
      request.data.endpoint,
      request.data.method,
      request.data.body
    )
    .then(sendResponse)
    .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  /* ---------------- EXTRACT PDF ---------------- */
  if (request.type === "EXTRACT_PDF") {
    apiRequest("/extract/pdf", "POST", {
      url: request.data.url
    })
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  /* ---------------- EXTRACT CONTENT ---------------- */
  if (request.type === 'EXTRACT_CONTENT') {
    handleExtractContent(request.data)
      .then(sendResponse)
      .catch(error => {
        console.error("[EXTRACT] ERROR:", error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  /* ---------------- SUMMARIZE ---------------- */
  if (request.type === 'SUMMARIZE') {
    handleSummarize(request.data)
      .then(sendResponse)
      .catch(error => {
        console.error("[SUMMARIZE] ERROR:", error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  /* ---------------- QA ---------------- */
  if (request.type === 'ASK_QUESTION') {
    handleAskQuestion(request.data)
      .then(sendResponse)
      .catch(error => {
        console.error("[QA] ERROR:", error);
        sendResponse({ error: error.message });
      });
    return true;
  }

  /* ---------------- MULTI PAGE QA ---------------- */
  if (request.type === 'MULTI_PAGE_QUESTION') {
    handleMultiPageQuestion(request.data)
      .then(sendResponse)
      .catch(error => {
        console.error("[MULTI_QA] ERROR:", error);
        sendResponse({ error: error.message });
      });
    return true;
  }
});

/* ============================================================
   LOAD SESSION FROM STORAGE ON STARTUP
============================================================ */
chrome.storage.local.get(['globalSession'], (result) => {
  if (result.globalSession) {
    globalSession = result.globalSession;
    console.log("[INIT] Loaded session from storage:", globalSession);
  }
});

/* ============================================================
   GOOGLE SIGN IN FLOW
============================================================ */
function googleSignIn() {
  const CLIENT_ID = __GOOGLE_CLIENT_ID__;
  const redirectUri = chrome.identity.getRedirectURL();
  const nonce = Math.random().toString(36).substring(2);

  console.log("[AUTH] CLIENT_ID loaded:", CLIENT_ID?.slice(0, 15));
  console.log("[AUTH] Redirect URI:", redirectUri);

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    "?client_id=" + CLIENT_ID +
    "&response_type=id_token" +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&scope=openid%20email%20profile" +
    "&nonce=" + nonce;

  console.log("[AUTH] Launching WebAuthFlow...");

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (redirectUrl) => {

        if (chrome.runtime.lastError) {
          console.error("[AUTH] Chrome runtime error:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError.message);
          return;
        }

        console.log("[AUTH] Redirect URL received:", redirectUrl);

        if (!redirectUrl) {
          reject("No redirect URL returned");
          return;
        }

        const hash = new URL(redirectUrl).hash.substring(1);
        const params = new URLSearchParams(hash);
        const idToken = params.get("id_token");

        if (!idToken) {
          reject("No Google ID token received");
          return;
        }

        resolve(idToken);
      }
    );
  });
}

/* ============================================================
   AUTH TOKEN HANDLER
============================================================ */
async function getAuthToken() {
  const result = await chrome.storage.local.get(['authToken']);
  console.log("[AUTH] Token from storage:", result.authToken?.slice(0, 20));
  return result.authToken || null;
}

/* ============================================================
   API REQUEST WRAPPER
============================================================ */
async function apiRequest(endpoint, method = 'GET', data = null) {

  const token = await getAuthToken();

  if (!token) {
    console.warn("[API] No token present");
    throw new Error("Not authenticated");
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log("[API] Request:", method, url);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const options = { method, headers };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  console.log("[API] Response status:", response.status);

  const raw = await response.text();
  console.log("[API] Raw response:", raw);

  if (!response.ok) {
    throw new Error(raw || 'API request failed');
  }

  return JSON.parse(raw);
}

/* ============================================================
   HANDLERS
============================================================ */

async function handleExtractContent({ url, html }) {
  console.log("[EXTRACT] Request received for URL:", url);
  const result = await apiRequest('/extract/', 'POST', {
    url,
    html,
    include_images: false
  });
  
  // Store chunks in session
  if (result?.text_chunks) {
    globalSession.pageChunks = {
      ...globalSession.pageChunks,
      [url]: result.text_chunks
    };
    await chrome.storage.local.set({ globalSession });
    console.log("[EXTRACT] Stored chunks for:", url);
  }
  
  return result;
}

async function handleSummarize({ chunks, style, chatId, url }) {
  console.log("[SUMMARIZE] Request received for chat:", chatId);
  return apiRequest('/summarize/', 'POST', {
    page_id: 1,
    url: url || "",
    chunks,
    summary_style: style || "short",
    max_tokens: 512,
    chat_id: chatId
  });
}

async function handleAskQuestion({ question, chunks, chatId, chatHistory }) {
  console.log("[QA] Request received for chat:", chatId);
  console.log("[QA] Number of chunks:", chunks?.length);
  console.log("[QA] Chat history length:", chatHistory?.length);
  
  return apiRequest('/qa/', 'POST', {
    question,
    chunks,
    chat_id: chatId,
    chat_history: chatHistory
  });
}

async function handleMultiPageQuestion({ question, urls, chatId }) {
  console.log("[MULTI_QA] Request received");
  return apiRequest('/qa/multi-page', 'POST', {
    question,
    urls,
    chat_id: chatId
  });
}

/* ============================================================
   INSTALL EVENT
============================================================ */
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[INIT] Extension installed:", details.reason);
  
  // Initialize empty session on fresh install
  if (details.reason === 'install') {
    chrome.storage.local.set({ globalSession });
  }
});