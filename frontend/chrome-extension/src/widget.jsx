import React, { useState, useEffect, useRef } from 'react';
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

const API_BASE = "http://127.0.0.1:8000/api/v1";

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
  // Format: { chatId: [{ role, content, pageUrl, pageTitle }] }
  const [chatMessages, setChatMessages] = useState({});

  /* ================= EXTRACTED CHUNKS (per page) ================= */
  // Format: { pageUrl: chunks[] }
  const [pageChunks, setPageChunks] = useState({});

  const [question, setQuestion] = useState("");
  const messagesEndRef = useRef(null);

  /* ================= SCROLL TO BOTTOM ================= */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, currentChatId]);

  /* ================= CHECK AUTH ================= */
  useEffect(() => {
    chrome.storage.local.get(["authToken"], (res) => {
      if (res.authToken) {
        setIsAuthenticated(true);
        loadChats();
      }
      setCheckingAuth(false);
    });
  }, []);

  /* ================= LOAD SESSION FROM BACKGROUND ================= */
  useEffect(() => {
    if (!isAuthenticated) return;

    chrome.runtime.sendMessage({ type: "GET_SESSION" }, (res) => {
      if (!res) return;
      
      if (res.currentChatId) {
        setCurrentChatId(res.currentChatId);
      }
      
      if (res.chatSummaries) {
        setChatSummaries(res.chatSummaries);
      }
      
      if (res.chatMessages) {
        setChatMessages(res.chatMessages);
      }
      
      if (res.pageChunks) {
        setPageChunks(res.pageChunks);
      }
    });
  }, [isAuthenticated]);

  /* ================= SAVE SESSION TO BACKGROUND ================= */
  const saveSession = () => {
    chrome.runtime.sendMessage({
      type: "SET_SESSION",
      data: {
        currentChatId,
        chatSummaries,
        chatMessages,
        pageChunks
      }
    });
  };

  useEffect(() => {
    saveSession();
  }, [currentChatId, chatSummaries, chatMessages, pageChunks]);

  /* ================= LOAD CHATS FROM BACKEND ================= */
  const loadChats = async () => {
    const res = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: {
        endpoint: "/chat/",
        method: "GET"
      }
    });

    if (res && Array.isArray(res)) {
      setChats(res);
      
      // If no current chat, set the first one
      if (!currentChatId && res.length > 0) {
        setCurrentChatId(res[0].id);
      }
    }
  };

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

    // Add to chats list
    setChats(prev => [res, ...prev]);
    
    // Switch to new chat
    setCurrentChatId(res.id);
    
    // Initialize empty data for this chat
    setChatSummaries(prev => ({ ...prev, [res.id]: [] }));
    setChatMessages(prev => ({ ...prev, [res.id]: [] }));
  };

  /* ================= DELETE CHAT ================= */
  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    
    const res = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: {
        endpoint: `/chat/${chatId}`,
        method: "DELETE"
      }
    });

    if (res) {
      // Remove from chats
      setChats(prev => prev.filter(c => c.id !== chatId));
      
      // Remove data
      setChatSummaries(prev => {
        const updated = { ...prev };
        delete updated[chatId];
        return updated;
      });
      
      setChatMessages(prev => {
        const updated = { ...prev };
        delete updated[chatId];
        return updated;
      });
      
      // Switch to another chat if this was active
      if (currentChatId === chatId) {
        const remaining = chats.filter(c => c.id !== chatId);
        setCurrentChatId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  /* ================= SWITCH CHAT ================= */
  const switchChat = (chatId) => {
    setCurrentChatId(chatId);
    setShowChatSidebar(false);
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
        console.log("[WIDGET] Extracted content:", data);

        if (data?.text_chunks && pageInfo?.url) {
          // Store chunks for this page
          setPageChunks(prev => ({
            ...prev,
            [pageInfo.url]: data.text_chunks
          }));
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pageInfo]);

  /* ================= REQUEST EXTRACTION ================= */
  const requestPageContent = () => {
    console.log("[WIDGET] Requesting page extraction");
    window.parent.postMessage({ type: "EXTRACT_PAGE_CONTENT" }, "*");
  };

  /* ================= GENERATE SUMMARY ================= */
  const generateSummary = async () => {
    if (!currentChatId || !pageInfo?.url) return;

    // Check if we already have chunks for this page
    let chunks = pageChunks[pageInfo.url];
    
    if (!chunks || chunks.length === 0) {
      // Request extraction first
      requestPageContent();
      
      // Wait a bit for extraction to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check again
      chunks = pageChunks[pageInfo.url];
      
      if (!chunks || chunks.length === 0) {
        alert("Failed to extract page content. Please try again.");
        return;
      }
    }

    try {
      setLoading(true);

      const res = await chrome.runtime.sendMessage({
        type: "SUMMARIZE",
        data: {
          chunks: chunks,
          style: "short",
          url: pageInfo.url,
          chatId: currentChatId
        }
      });

      if (res?.error) throw new Error(res.error);

      // Add summary to this chat's summary list
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

    // Add to chat messages
    const updatedMessages = [...(chatMessages[currentChatId] || []), userMessage];
    setChatMessages(prev => ({
      ...prev,
      [currentChatId]: updatedMessages
    }));

    setQuestion("");

    // Get chunks for ALL pages mentioned in this chat
    const allPageUrls = [...new Set(updatedMessages.map(m => m.pageUrl).filter(Boolean))];
    let allChunks = [];
    
    for (const url of allPageUrls) {
      if (pageChunks[url]) {
        allChunks = [...allChunks, ...pageChunks[url]];
      }
    }

    // If no chunks for current page, extract first
    if (!pageChunks[pageInfo.url]) {
      requestPageContent();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (pageChunks[pageInfo.url]) {
        allChunks = [...allChunks, ...pageChunks[pageInfo.url]];
      }
    }

    if (allChunks.length === 0) {
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

      // Prepare chat history for API
      const chatHistory = updatedMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await chrome.runtime.sendMessage({
        type: "ASK_QUESTION",
        data: {
          question: userMessage.content,
          chunks: allChunks, // Send all chunks from all pages in this chat
          chatId: currentChatId,
          chatHistory: chatHistory
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

  /* ================= GET CURRENT CHAT SUMMARIES ================= */
  const currentSummaries = chatSummaries[currentChatId] || [];
  const currentMessages = chatMessages[currentChatId] || [];

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
                {/* Show all summaries for this chat */}
                {currentSummaries.map((sum, idx) => (
                  <div key={idx} className="summary-item">
                    <div className="summary-header">
                      <strong>{sum.pageTitle}</strong>
                      <span className="summary-url">{new URL(sum.pageUrl).hostname}</span>
                    </div>
                    <div className="summary-text">{sum.summary}</div>
                  </div>
                ))}
                
                {/* Always show summarize button for current page */}
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
                      <>
                        <Sparkles size={16}/> Summarize Current Page
                      </>
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
                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
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
