import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import {
  MessageCircle,
  FileText,
  Sparkles,
  X,
  Send,
  Loader2,
  Plus,
  Trash2,
  MessageSquare
} from 'lucide-react';
import './widget.css';

/* ================================================================
   INTENT DETECTION
   Decides whether a question needs cross-page context or just the
   current page.
================================================================ */
const MULTI_PAGE_KEYWORDS = [
  'compare', 'comparison', 'difference', 'differ',
  'previous page', 'last page', 'other page', 'another page',
  'both pages', 'between pages', 'across pages',
  'vs', 'versus', 'than the previous', 'compared to',
  'earlier page', 'pages i visited', 'all pages'
];

function isMultiPageQuestion(question) {
  const q = question.toLowerCase();
  return MULTI_PAGE_KEYWORDS.some(k => q.includes(k));
}

/* ================================================================
   WIDGET COMPONENT
================================================================ */
const Widget = () => {

  /* ================= AUTH ================= */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= APP STATE ================= */
  const [activeTab, setActiveTab] = useState("summary");
  const [pageInfo, setPageInfo] = useState(null);

  /* ================= CHAT STATE ================= */
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showChatSidebar, setShowChatSidebar] = useState(false);

  /* ================= SUMMARY STATE (per chat) ================= */
  // Format: { chatId: [{ pageUrl, pageTitle, summary, timestamp }] }
  const [chatSummaries, setChatSummaries] = useState({});

  /* ================= Q&A STATE (per chat) ================= */
  // Loaded from backend on init/chat-switch; kept in sync with DB.
  // Format: { chatId: [{ role, content, pageUrl, pageTitle, sources }] }
  const [chatMessages, setChatMessages] = useState({});

  /* ================= EXTRACTED CHUNKS (per page URL) ================= */
  // Format: { pageUrl: chunks[] }  — NOT stored in backend, lives in session
  const [pageChunks, setPageChunks] = useState({});

  const [question, setQuestion] = useState("");
  const messagesEndRef = useRef(null);

  /* ================= SCROLL TO BOTTOM ================= */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, currentChatId]);

  /* ================= LOAD MESSAGES FROM BACKEND ================= */
  const loadChatMessages = useCallback(async (chatId) => {
    if (!chatId) return;
    const res = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: { endpoint: `/chat/${chatId}`, method: "GET" }
    });

    if (res?.messages && Array.isArray(res.messages)) {
      const messages = res.messages.map(m => ({
        role: m.role,
        content: m.content,
        pageUrl: m.url || m.extra_data?.url || null,
        pageTitle: m.page_title || m.extra_data?.page_title || null,
        sources: m.extra_data?.sources || null,
        type: m.extra_data?.type || null,
      }));
      setChatMessages(prev => ({ ...prev, [chatId]: messages }));

      // Rebuild chatSummaries from stored summary messages
      const summaries = messages
        .filter(m => m.type === "summary" && m.role === "assistant" && m.pageUrl)
        .map(m => ({
          pageUrl: m.pageUrl,
          pageTitle: m.pageTitle,
          summary: m.content,
          timestamp: null,
        }));
      if (summaries.length > 0) {
        setChatSummaries(prev => ({ ...prev, [chatId]: summaries }));
      }
    }
  }, []);

  /* ================= LOAD CHATS FROM BACKEND ================= */
  const loadChats = useCallback(async () => {
    const res = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: { endpoint: "/chat/", method: "GET" }
    });

    if (!res || !Array.isArray(res)) return;

    setChats(res);

    // Restore currentChatId from session, or default to first chat
    const sessionRes = await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: "GET_SESSION" }, resolve)
    );

    let chatId = sessionRes?.currentChatId;
    if (!chatId && res.length > 0) chatId = res[0].id;

    if (chatId) {
      setCurrentChatId(chatId);
      await loadChatMessages(chatId);
    }

    // Restore page chunks from session (not stored in DB)
    if (sessionRes?.pageChunks) {
      setPageChunks(sessionRes.pageChunks);
    }
  }, [loadChatMessages]);

  /* ================= CHECK AUTH ================= */
  useEffect(() => {
    chrome.storage.local.get(["authToken"], (res) => {
      if (res.authToken) {
        setIsAuthenticated(true);
        loadChats();
      }
      setCheckingAuth(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================= SAVE SESSION (page chunks + currentChatId only) ================= */
  useEffect(() => {
    chrome.runtime.sendMessage({
      type: "SET_SESSION",
      data: { currentChatId, pageChunks }
    });
  }, [currentChatId, pageChunks]);

  /* ================= CREATE NEW CHAT ================= */
  const createNewChat = async () => {
    const res = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: {
        endpoint: "/chat/",
        method: "POST",
        body: { title: `Chat ${chats.length + 1}` }
      }
    });

    if (!res?.id) return;

    setChats(prev => [res, ...prev]);
    setCurrentChatId(res.id);
    setChatSummaries(prev => ({ ...prev, [res.id]: [] }));
    setChatMessages(prev => ({ ...prev, [res.id]: [] }));
  };

  /* ================= DELETE CHAT ================= */
  const deleteChat = async (chatId, e) => {
    e.stopPropagation();

    const res = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: { endpoint: `/chat/${chatId}`, method: "DELETE" }
    });

    if (res) {
      setChats(prev => prev.filter(c => c.id !== chatId));
      setChatSummaries(prev => { const u = { ...prev }; delete u[chatId]; return u; });
      setChatMessages(prev => { const u = { ...prev }; delete u[chatId]; return u; });

      if (currentChatId === chatId) {
        const remaining = chats.filter(c => c.id !== chatId);
        const nextId = remaining.length > 0 ? remaining[0].id : null;
        setCurrentChatId(nextId);
        if (nextId) loadChatMessages(nextId);
      }
    }
  };

  /* ================= SWITCH CHAT ================= */
  const switchChat = async (chatId) => {
    setCurrentChatId(chatId);
    setShowChatSidebar(false);
    await loadChatMessages(chatId);
  };

  /* ================= GOOGLE LOGIN ================= */
  const handleGoogleLogin = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: "GOOGLE_LOGIN" }, (res) => {
      setLoading(false);
      if (res?.success) {
        setIsAuthenticated(true);
        loadChats();
      } else {
        setAuthError("Google login failed");
      }
    });
  };

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
    await chrome.storage.local.remove(["authToken"]);
    setIsAuthenticated(false);
    setChats([]);
    setCurrentChatId(null);
    setChatSummaries({});
    setChatMessages({});
    setPageChunks({});
  };

  /* ================= LISTEN FROM CONTENT SCRIPT ================= */
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === "PAGE_INFO") {
        setPageInfo(event.data.data);
      }

      if (event.data?.type === "PAGE_CONTENT_EXTRACTED") {
        const data = event.data.data;
        if (data?.text_chunks && data.url) {
          setPageChunks(prev => ({ ...prev, [data.url]: data.text_chunks }));

          // Record page visit in backend if we have a chat
          if (currentChatId) {
            chrome.runtime.sendMessage({
              type: "API_CALL",
              data: {
                endpoint: `/chat/${currentChatId}/page-visit`,
                method: "POST",
                body: { url: data.url, title: data.title || null }
              }
            });
          }
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pageInfo, currentChatId]);

  /* ================= REQUEST EXTRACTION ================= */
  const requestPageContent = () => {
    window.parent.postMessage({ type: "EXTRACT_PAGE_CONTENT" }, "*");
  };

  /* ================= ENSURE CHUNKS FOR URL ================= */
  const ensureChunks = async (url) => {
    if (pageChunks[url]?.length > 0) return pageChunks[url];
    requestPageContent();
    await new Promise(resolve => setTimeout(resolve, 2000));
    return pageChunks[url] || null;
  };

  /* ================= GENERATE SUMMARY ================= */
  const generateSummary = async () => {
    if (!currentChatId || !pageInfo?.url) return;

    const chunks = await ensureChunks(pageInfo.url);
    if (!chunks) {
      alert("Failed to extract page content. Please try again.");
      return;
    }

    try {
      setLoading(true);

      const res = await chrome.runtime.sendMessage({
        type: "SUMMARIZE",
        data: {
          chunks,
          style: "short",
          url: pageInfo.url,
          pageTitle: pageInfo.title,
          chatId: currentChatId
        }
      });

      if (res?.error) throw new Error(res.error);

      const newSummary = {
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title,
        summary: res.summary,
        timestamp: new Date().toISOString()
      };

      setChatSummaries(prev => ({
        ...prev,
        [currentChatId]: [...(prev[currentChatId] || []), newSummary]
      }));

      // Add the summary as a message so it persists across pages
      setChatMessages(prev => ({
        ...prev,
        [currentChatId]: [
          ...(prev[currentChatId] || []),
          {
            role: "assistant",
            content: res.summary,
            pageUrl: pageInfo.url,
            pageTitle: pageInfo.title,
            type: "summary"
          }
        ]
      }));

    } catch (err) {
      console.error("[WIDGET] Summary error:", err);
      alert("Summary generation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= ASK QUESTION ================= */
  const handleAskQuestion = async () => {
    if (!question.trim() || !currentChatId || !pageInfo?.url) return;

    const userMessage = {
      role: "user",
      content: question,
      pageUrl: pageInfo.url,
      pageTitle: pageInfo.title
    };

    const updatedMessages = [...(chatMessages[currentChatId] || []), userMessage];
    setChatMessages(prev => ({ ...prev, [currentChatId]: updatedMessages }));
    setQuestion("");

    // Detect intent: cross-page or current-page only
    const multiPage = isMultiPageQuestion(question);

    let chunksToSend = [];

    if (multiPage) {
      // Collect chunks from ALL pages extracted in this chat session
      const allUrls = Object.keys(pageChunks);
      for (const url of allUrls) {
        if (pageChunks[url]?.length > 0) {
          chunksToSend = [...chunksToSend, ...pageChunks[url]];
        }
      }
      // Ensure current page is also included
      if (!pageChunks[pageInfo.url]) {
        const cur = await ensureChunks(pageInfo.url);
        if (cur) chunksToSend = [...chunksToSend, ...cur];
      }
    } else {
      // Current page only
      chunksToSend = await ensureChunks(pageInfo.url) || [];
    }

    if (chunksToSend.length === 0) {
      const errorMsg = {
        role: "assistant",
        content: "Failed to extract page content. Please try again.",
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      };
      setChatMessages(prev => ({
        ...prev,
        [currentChatId]: [...updatedMessages, errorMsg]
      }));
      return;
    }

    try {
      setLoading(true);

      const chatHistory = updatedMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await chrome.runtime.sendMessage({
        type: "ASK_QUESTION",
        data: {
          question: userMessage.content,
          chunks: chunksToSend,
          chatId: currentChatId,
          chatHistory,
          url: pageInfo.url,
          pageTitle: pageInfo.title
        }
      });

      if (res?.error) throw new Error(res.error);

      const assistantMessage = {
        role: "assistant",
        content: res.answer,
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title,
        sources: res.sources
      };

      setChatMessages(prev => ({
        ...prev,
        [currentChatId]: [...updatedMessages, assistantMessage]
      }));

    } catch (err) {
      console.error("[WIDGET] QA error:", err);
      const errorMsg = {
        role: "assistant",
        content: "Failed to answer question. Please try again.",
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title
      };
      setChatMessages(prev => ({
        ...prev,
        [currentChatId]: [...updatedMessages, errorMsg]
      }));
    } finally {
      setLoading(false);
    }
  };

  /* ================= DERIVED STATE ================= */
  const currentSummaries = chatSummaries[currentChatId] || [];
  const currentMessages = (chatMessages[currentChatId] || []).filter(m => m.type !== "summary");

  /* ================= LOADING ================= */
  if (checkingAuth) {
    return (
      <div className="widget-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Loader2 className="spinner" size={32}/>
        </div>
      </div>
    );
  }

  /* ================= LOGIN ================= */
  if (!isAuthenticated) {
    return (
      <div className="widget-container login-screen">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Sparkles size={48} style={{ margin: '0 auto 20px', color: '#667eea' }}/>
          <h2 style={{ marginBottom: '10px' }}>PageSense</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>AI-powered web assistant</p>
          {authError && <p style={{ color: 'red', marginBottom: '20px' }}>{authError}</p>}
          <button
            className="primary-button"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ width: '100%', maxWidth: '300px' }}
          >
            {loading ? <Loader2 className="spinner" size={16}/> : 'Continue with Google'}
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN UI ================= */
  return (
    <div className="widget-container">

      {/* CHAT SIDEBAR */}
      {showChatSidebar && (
        <div className="chat-sidebar-overlay" onClick={() => setShowChatSidebar(false)}>
          <div className="chat-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <h3>Chats</h3>
              <button onClick={() => setShowChatSidebar(false)}>
                <X size={18}/>
              </button>
            </div>

            <div className="sidebar-content">
              {chats.map(chat => (
                <div
                  key={chat.id}
                  className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
                  onClick={() => switchChat(chat.id)}
                >
                  <MessageSquare size={16}/>
                  <span>{chat.title}</span>
                  <button
                    className="delete-chat-btn"
                    onClick={(e) => deleteChat(chat.id, e)}
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              ))}

              {chats.length === 0 && (
                <div className="empty-state">
                  <p>No chats yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="widget-header">
        <button
          className="sidebar-toggle"
          onClick={() => setShowChatSidebar(true)}
          title="View all chats"
        >
          <MessageSquare size={20}/>
        </button>

        <div className="widget-title">
          <Sparkles size={20}/>
          PageSense
        </div>

        <div style={{display:"flex", gap:"8px", alignItems: "center"}}>
          <button className="primary-button" onClick={createNewChat} disabled={chats.length >= 3}>
            <Plus size={16}/>
          </button>

          <button className="logout-btn" onClick={handleLogout} title="Logout">
            Logout
          </button>

          <button
            className="close-button"
            onClick={()=>window.parent.postMessage({type:"CLOSE_WIDGET"},"*")}
            title="Close widget"
          >
            <X size={18}/>
          </button>
        </div>
      </div>

      {/* CURRENT CHAT INFO */}
      {currentChatId && (
        <div className="current-chat-info">
          <span>Chat {chats.findIndex(c => c.id === currentChatId) + 1} of {chats.length}</span>
        </div>
      )}

      {/* PAGE INFO */}
      {pageInfo && (
        <div className="page-info">
          <div className="page-title">{pageInfo.title}</div>
          <div className="page-url">{new URL(pageInfo.url).hostname}</div>
        </div>
      )}

      {/* TABS */}
      <div className="tabs">
        <button
          className={`tab ${activeTab==="summary"?"active":""}`}
          onClick={()=>setActiveTab("summary")}
        >
          <FileText size={16}/> Summary
        </button>

        <button
          className={`tab ${activeTab==="ask"?"active":""}`}
          onClick={()=>setActiveTab("ask")}
        >
          <MessageCircle size={16}/> Ask
        </button>
      </div>

      {/* CONTENT */}
      <div className="widget-content">

        {!currentChatId ? (
          <div className="empty-state">
            <p>Create a new chat to get started</p>
            <button className="primary-button" onClick={createNewChat}>
              <Plus size={16}/> New Chat
            </button>
          </div>
        ) : (
          <>
            {/* SUMMARY TAB */}
            {activeTab === "summary" && (
              <div className="summary-section">
                {currentSummaries.map((sum, idx) => (
                  <div key={idx} className="summary-item">
                    <div className="summary-header">
                      <strong>{sum.pageTitle}</strong>
                      <span className="summary-url">{new URL(sum.pageUrl).hostname}</span>
                    </div>
                    <div className="summary-text">{sum.summary}</div>
                  </div>
                ))}

                {pageInfo && (
                  <button
                    className="primary-button"
                    onClick={generateSummary}
                    disabled={loading}
                    style={{ marginTop: currentSummaries.length > 0 ? '16px' : '0' }}
                  >
                    {loading ? (
                      <Loader2 className="spinner" size={16}/>
                    ) : (
                      <><Sparkles size={16}/> Summarize Current Page</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ASK TAB */}
            {activeTab === "ask" && (
              <div className="ask-section">
                <div className="messages-container">
                  {currentMessages.map((m, i) => (
                    <div key={i} className={`message ${m.role}`}>
                      {m.pageTitle && m.role === 'user' && (
                        <div className="message-context">
                          On: {m.pageTitle}
                        </div>
                      )}
                      <div className="message-content">{m.content}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />

                  {loading && (
                    <div className="message assistant">
                      <Loader2 className="spinner" size={16}/>
                    </div>
                  )}
                </div>

                <div className="input-container">
                  <input
                    value={question}
                    onChange={(e)=>setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                    placeholder="Ask about this page or compare pages..."
                    disabled={loading}
                  />
                  <button
                    onClick={handleAskQuestion}
                    disabled={loading || !question.trim()}
                  >
                    <Send size={16}/>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Widget />);
