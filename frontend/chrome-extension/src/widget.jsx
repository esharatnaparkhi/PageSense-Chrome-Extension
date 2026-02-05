import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import {
  MessageCircle,
  FileText,
  Sparkles,
  X,
  Send,
  Loader2
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

  const [summary, setSummary] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");

  // ⭐ IMPORTANT — STORE EXTRACTED CHUNKS
  const [extractedChunks, setExtractedChunks] = useState([]);

  const messagesEndRef = useRef(null);

  /* ================= CHECK AUTH ================= */
  useEffect(() => {
    chrome.storage.local.get(["authToken"], (res) => {
      if (res.authToken) setIsAuthenticated(true);
      setCheckingAuth(false);
    });
  }, []);

  /* ================= GOOGLE LOGIN ================= */
  const handleGoogleLogin = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: "GOOGLE_LOGIN" }, (res) => {
      setLoading(false);
      if (res?.success) setIsAuthenticated(true);
      else setAuthError("Google login failed");
    });
  };

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
    await chrome.storage.local.remove(["authToken"]);
    setIsAuthenticated(false);
  };

  /* ===================================================
     LISTEN FROM CONTENT SCRIPT (PAGE INFO + CONTENT)
  =================================================== */
  useEffect(() => {

    const handler = (event) => {

      if (event.data?.type === "PAGE_INFO") {
        setPageInfo(event.data.data);
      }

      if (event.data?.type === "PAGE_CONTENT_EXTRACTED") {

        const data = event.data.data;

        console.log("[WIDGET] Extracted content:", data);

        if (data?.text_chunks) {
          setExtractedChunks(data.text_chunks);
        }

        // Auto summarize only if summary tab
        if (activeTab === "summary") {
          generateSummary(data.text_chunks);
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);

  }, [activeTab]);

  /* ================= REQUEST EXTRACTION ================= */
  const requestPageContent = () => {
    console.log("[WIDGET] Requesting page extraction");
    window.parent.postMessage({ type: "EXTRACT_PAGE_CONTENT" }, "*");
  };

  /* ================= GENERATE SUMMARY ================= */
  const generateSummary = async (chunks) => {

    if (!chunks || !chunks.length) return;

    try {

      setLoading(true);

      const res = await chrome.runtime.sendMessage({
        type: "SUMMARIZE",
        data: {
          chunks: chunks,
          style: "short",
          url: pageInfo?.url
        }
      });

      if (res?.error) throw new Error(res.error);

      setSummary(res.summary);

    } catch (err) {
      console.error("[WIDGET] Summary error:", err);
      setSummary("Summary failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= ASK QUESTION ================= */
  const handleAskQuestion = async () => {

    if (!question.trim()) return;

    const userMessage = { role: "user", content: question };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setQuestion("");

    // ⭐ If no chunks yet — extract first
    if (!extractedChunks.length) {
      console.log("[WIDGET] No chunks yet — requesting extraction first");
      requestPageContent();
      return;
    }

    try {

      setLoading(true);

      const res = await chrome.runtime.sendMessage({
        type: "ASK_QUESTION",
        data: {
          question: userMessage.content,
          chunks: extractedChunks,
          chatHistory: updatedMessages.slice(-10)
        }
      });

      if (res?.error) throw new Error(res.error);

      setMessages([
        ...updatedMessages,
        { role: "assistant", content: res.answer }
      ]);

    } catch (err) {

      console.error("[WIDGET] QA error:", err);

      setMessages([
        ...updatedMessages,
        { role: "assistant", content: "Failed to answer." }
      ]);
    }

    setLoading(false);
  };

  /* ================= LOADING ================= */
  if (checkingAuth) {
    return (
      <div className="widget-container">
        <Loader2 className="spinner" size={32}/>
      </div>
    );
  }

  /* ================= LOGIN ================= */
  if (!isAuthenticated) {
    return (
      <div className="widget-container login-screen">
        <h2>Login to PageSense</h2>
        {authError && <p>{authError}</p>}
        <button className="primary-button" onClick={handleGoogleLogin}>
          Continue with Google
        </button>
      </div>
    );
  }

  /* ================= MAIN UI ================= */
  return (
    <div className="widget-container">

      <div className="widget-header">
        <div className="widget-title">
          <Sparkles size={20}/>
          PageSense
        </div>
        <button className="close-button" onClick={handleLogout}>
          <X size={18}/>
        </button>
      </div>

      {pageInfo && (
        <div className="page-info">
          <div className="page-title">{pageInfo.title}</div>
          <div className="page-url">{new URL(pageInfo.url).hostname}</div>
        </div>
      )}

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

      <div className="widget-content">

        {/* SUMMARY TAB */}
        {activeTab === "summary" && (
          <>
            {!summary && !loading && (
              <button className="primary-button" onClick={requestPageContent}>
                <Sparkles size={16}/> Summarize Page
              </button>
            )}

            {loading && <Loader2 className="spinner"/>}

            {summary && (
              <div className="summary-text">{summary}</div>
            )}
          </>
        )}

        {/* ASK TAB */}
        {activeTab === "ask" && (
          <>
            {messages.map((m,i)=>(
              <div key={i} className={`message ${m.role}`}>
                {m.content}
              </div>
            ))}

            <div className="input-container">
              <input
                value={question}
                onChange={(e)=>setQuestion(e.target.value)}
                placeholder="Ask something..."
              />
              <button onClick={handleAskQuestion}>
                <Send size={16}/>
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Widget />);
