import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Loader2 } from "lucide-react";

import "./globals.css";

import { Header } from "@/components/layout/Header";
import { TabBar } from "@/components/layout/TabBar";
import { PageInfoBar } from "@/components/layout/PageInfoBar";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { SummaryView } from "@/components/summary/SummaryView";
import { Button } from "@/components/ui/Button";

import {
  type Chat,
  type Message,
  type PageInfo,
  type ChatSummary,
  type TextChunk,
  type ActiveTab,
} from "@/types";

/* ================================================================
   INTENT DETECTION
================================================================ */
const MULTI_PAGE_KEYWORDS = [
  "compare",
  "comparison",
  "difference",
  "differ",
  "previous page",
  "last page",
  "other page",
  "another page",
  "both pages",
  "between pages",
  "across pages",
  "vs",
  "versus",
  "than the previous",
  "compared to",
  "earlier page",
  "pages i visited",
  "all pages",
];

function isMultiPageQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return MULTI_PAGE_KEYWORDS.some((k) => q.includes(k));
}

/* ================================================================
   TYPES FOR CHROME API RESPONSES
================================================================ */
interface SendMessageResponse {
  error?: string;
  success?: boolean;
  summary?: string;
  answer?: string;
  sources?: unknown;
  messages?: Array<{
    role: "user" | "assistant";
    content: string;
    url?: string;
    page_title?: string;
    extra_data?: {
      url?: string;
      page_title?: string;
      sources?: unknown;
      type?: string;
    };
  }>;
  id?: number;
  title?: string;
  currentChatId?: number | null;
  pageChunks?: Record<string, TextChunk[]>;
}

/* ================================================================
   WIDGET COMPONENT
================================================================ */
const Widget: React.FC = () => {
  /* ================= AUTH ================= */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= APP STATE ================= */
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);

  /* ================= CHAT STATE ================= */
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [showChatSidebar, setShowChatSidebar] = useState(false);

  /* ================= SUMMARY STATE (per chat) ================= */
  const [chatSummaries, setChatSummaries] = useState<
    Record<number, ChatSummary[]>
  >({});

  /* ================= Q&A STATE (per chat) ================= */
  const [chatMessages, setChatMessages] = useState<Record<number, Message[]>>(
    {}
  );

  /* ================= EXTRACTED CHUNKS (per page URL) ================= */
  const [pageChunks, setPageChunks] = useState<Record<string, TextChunk[]>>(
    {}
  );

  /* ref always holds the latest pageChunks — avoids stale closures */
  const pageChunksRef = useRef<Record<string, TextChunk[]>>({});
  useEffect(() => {
    pageChunksRef.current = pageChunks;
  }, [pageChunks]);

  /* ================= SESSION EXPIRY HANDLER ================= */
  const handleSessionExpired = useCallback(
    async (res: SendMessageResponse | null): Promise<boolean> => {
      if (
        res?.error === "SESSION_EXPIRED" ||
        res?.error === "Not authenticated"
      ) {
        await chrome.storage.local.remove(["authToken"]);
        setIsAuthenticated(false);
        setChats([]);
        setCurrentChatId(null);
        setChatSummaries({});
        setChatMessages({});
        setPageChunks({});
        return true;
      }
      return false;
    },
    []
  );

  /* ================= LOAD MESSAGES FROM BACKEND ================= */
  const loadChatMessages = useCallback(
    async (chatId: number) => {
      if (!chatId) return;
      const res: SendMessageResponse = await chrome.runtime.sendMessage({
        type: "API_CALL",
        data: { endpoint: `/chat/${chatId}`, method: "GET" },
      });

      if (await handleSessionExpired(res)) return;

      if (res?.messages && Array.isArray(res.messages)) {
        const messages: Message[] = res.messages.map((m) => ({
          role: m.role,
          content: m.content,
          pageUrl: m.url || m.extra_data?.url || null,
          pageTitle: m.page_title || m.extra_data?.page_title || null,
          sources: (m.extra_data?.sources as Message["sources"]) || null,
          type: m.extra_data?.type || null,
        }));
        setChatMessages((prev) => ({ ...prev, [chatId]: messages }));

        const summaries: ChatSummary[] = messages
          .filter(
            (m) => m.type === "summary" && m.role === "assistant" && m.pageUrl
          )
          .map((m) => ({
            pageUrl: m.pageUrl!,
            pageTitle: m.pageTitle || null,
            summary: m.content,
            timestamp: null,
          }));

        if (summaries.length > 0) {
          setChatSummaries((prev) => ({ ...prev, [chatId]: summaries }));
        }
      }
    },
    [handleSessionExpired]
  );

  /* ================= LOAD CHATS FROM BACKEND ================= */
  const loadChats = useCallback(async () => {
    const res: Chat[] | SendMessageResponse =
      await chrome.runtime.sendMessage({
        type: "API_CALL",
        data: { endpoint: "/chat/", method: "GET" },
      });

    if (await handleSessionExpired(res as SendMessageResponse)) return;
    if (!res || !Array.isArray(res)) return;

    setChats(res as Chat[]);

    const sessionRes: SendMessageResponse = await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "GET_SESSION" }, resolve)
    );

    let chatId = sessionRes?.currentChatId;
    if (!chatId && (res as Chat[]).length > 0)
      chatId = (res as Chat[])[0].id;

    if (chatId) {
      setCurrentChatId(chatId);
      await loadChatMessages(chatId);
    }

    if (sessionRes?.pageChunks) {
      setPageChunks(sessionRes.pageChunks);
    }
  }, [handleSessionExpired, loadChatMessages]);

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

  /* ================= SAVE SESSION ================= */
  useEffect(() => {
    chrome.runtime.sendMessage({
      type: "SET_SESSION",
      data: { currentChatId, pageChunks },
    });
  }, [currentChatId, pageChunks]);

  /* ================= CREATE NEW CHAT ================= */
  const createNewChat = async () => {
    const res: SendMessageResponse = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: {
        endpoint: "/chat/",
        method: "POST",
        body: { title: `Chat ${chats.length + 1}` },
      },
    });

    if (!res?.id) return;
    const newChat: Chat = res as unknown as Chat;

    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setChatSummaries((prev) => ({ ...prev, [newChat.id]: [] }));
    setChatMessages((prev) => ({ ...prev, [newChat.id]: [] }));
    setShowChatSidebar(false);
  };

  /* ================= DELETE CHAT ================= */
  const deleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const res: boolean = await chrome.runtime.sendMessage({
      type: "API_CALL",
      data: { endpoint: `/chat/${chatId}`, method: "DELETE" },
    });

    if (res) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      setChatSummaries((prev) => {
        const u = { ...prev };
        delete u[chatId];
        return u;
      });
      setChatMessages((prev) => {
        const u = { ...prev };
        delete u[chatId];
        return u;
      });

      if (currentChatId === chatId) {
        const remaining = chats.filter((c) => c.id !== chatId);
        const nextId = remaining.length > 0 ? remaining[0].id : null;
        setCurrentChatId(nextId);
        if (nextId) loadChatMessages(nextId);
      }
    }
  };

  /* ================= SWITCH CHAT ================= */
  const switchChat = async (chatId: number) => {
    setCurrentChatId(chatId);
    setShowChatSidebar(false);
    await loadChatMessages(chatId);
  };

  /* ================= GOOGLE LOGIN ================= */
  const handleGoogleLogin = () => {
    setLoading(true);
    chrome.runtime.sendMessage(
      { type: "GOOGLE_LOGIN" },
      (res: SendMessageResponse) => {
        setLoading(false);
        if (res?.success) {
          setIsAuthenticated(true);
          loadChats();
        } else {
          setAuthError("Google login failed. Please try again.");
        }
      }
    );
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
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PAGE_INFO") {
        setPageInfo(event.data.data as PageInfo);
      }

      if (event.data?.type === "PAGE_CONTENT_EXTRACTED") {
        const data = event.data.data;
        if (data?.text_chunks && data.url) {
          setPageChunks((prev) => ({ ...prev, [data.url]: data.text_chunks }));

          if (currentChatId) {
            chrome.runtime.sendMessage({
              type: "API_CALL",
              data: {
                endpoint: `/chat/${currentChatId}/page-visit`,
                method: "POST",
                body: { url: data.url, title: data.title || null },
              },
            });
          }
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [currentChatId]);

  /* ================= REQUEST EXTRACTION ================= */
  const requestPageContent = () => {
    window.parent.postMessage({ type: "EXTRACT_PAGE_CONTENT" }, "*");
  };

  /* ================= ENSURE CHUNKS FOR URL ================= */
  const ensureChunks = useCallback(
    (url: string): Promise<TextChunk[] | null> => {
      if (pageChunksRef.current[url]?.length > 0)
        return Promise.resolve(pageChunksRef.current[url]);

      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          window.removeEventListener("message", onExtracted);
          resolve(null);
        }, 10000);

        function onExtracted(event: MessageEvent) {
          if (event.data?.type === "PAGE_CONTENT_EXTRACTED") {
            clearTimeout(timeoutId);
            window.removeEventListener("message", onExtracted);
            const chunks: TextChunk[] | null =
              event.data.data?.text_chunks || null;
            resolve(chunks && chunks.length > 0 ? chunks : null);
          }
        }

        window.addEventListener("message", onExtracted);
        requestPageContent();
      });
    },
    []
  );

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

      const res: SendMessageResponse = await chrome.runtime.sendMessage({
        type: "SUMMARIZE",
        data: {
          chunks,
          style: "short",
          url: pageInfo.url,
          pageTitle: pageInfo.title,
          chatId: currentChatId,
        },
      });

      if (await handleSessionExpired(res)) return;
      if (res?.error) throw new Error(res.error);

      const newSummary: ChatSummary = {
        pageUrl: pageInfo.url,
        pageTitle: pageInfo.title,
        summary: res.summary!,
        timestamp: new Date().toISOString(),
      };

      setChatSummaries((prev) => ({
        ...prev,
        [currentChatId]: [...(prev[currentChatId] || []), newSummary],
      }));

      setChatMessages((prev) => ({
        ...prev,
        [currentChatId]: [
          ...(prev[currentChatId] || []),
          {
            role: "assistant",
            content: res.summary!,
            pageUrl: pageInfo.url,
            pageTitle: pageInfo.title,
            type: "summary",
          },
        ],
      }));
    } catch (err) {
      console.error("[WIDGET] Summary error:", err);
      alert("Summary generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ================= ASK QUESTION ================= */
  const handleAskQuestion = async (question: string) => {
    if (!question.trim() || !currentChatId || !pageInfo?.url) return;

    const userMessage: Message = {
      role: "user",
      content: question,
      pageUrl: pageInfo.url,
      pageTitle: pageInfo.title,
    };

    const updatedMessages = [
      ...(chatMessages[currentChatId] || []),
      userMessage,
    ];
    setChatMessages((prev) => ({
      ...prev,
      [currentChatId]: updatedMessages,
    }));

    const multiPage = isMultiPageQuestion(question);
    let chunksToSend: TextChunk[] = [];

    if (multiPage) {
      for (const url of Object.keys(pageChunks)) {
        if (pageChunks[url]?.length > 0) {
          chunksToSend = [...chunksToSend, ...pageChunks[url]];
        }
      }
      if (!pageChunks[pageInfo.url]) {
        const cur = await ensureChunks(pageInfo.url);
        if (cur) chunksToSend = [...chunksToSend, ...cur];
      }
    } else {
      chunksToSend = (await ensureChunks(pageInfo.url)) || [];
    }

    if (chunksToSend.length === 0) {
      setChatMessages((prev) => ({
        ...prev,
        [currentChatId]: [
          ...updatedMessages,
          {
            role: "assistant",
            content: "Failed to extract page content. Please try again.",
            pageUrl: pageInfo.url,
            pageTitle: pageInfo.title,
          },
        ],
      }));
      return;
    }

    try {
      setLoading(true);

      const chatHistory = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res: SendMessageResponse = await chrome.runtime.sendMessage({
        type: "ASK_QUESTION",
        data: {
          question,
          chunks: chunksToSend,
          chatId: currentChatId,
          chatHistory,
          url: pageInfo.url,
          pageTitle: pageInfo.title,
        },
      });

      if (await handleSessionExpired(res)) return;
      if (res?.error) throw new Error(res.error);

      setChatMessages((prev) => ({
        ...prev,
        [currentChatId]: [
          ...updatedMessages,
          {
            role: "assistant",
            content: res.answer!,
            pageUrl: pageInfo.url,
            pageTitle: pageInfo.title,
            sources: res.sources as Message["sources"],
          },
        ],
      }));
    } catch (err) {
      console.error("[WIDGET] QA error:", err);
      setChatMessages((prev) => ({
        ...prev,
        [currentChatId]: [
          ...updatedMessages,
          {
            role: "assistant",
            content: "Failed to answer question. Please try again.",
            pageUrl: pageInfo.url,
            pageTitle: pageInfo.title,
          },
        ],
      }));
    } finally {
      setLoading(false);
    }
  };

  /* ================= DERIVED STATE ================= */
  const currentSummaries = chatSummaries[currentChatId ?? 0] ?? [];
  const currentMessages = (chatMessages[currentChatId ?? 0] ?? []).filter(
    (m) => m.type !== "summary"
  );
  const currentChatIndex = currentChatId
    ? chats.findIndex((c) => c.id === currentChatId) + 1
    : 0;

  /* ================= LOADING ================= */
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <Loader2 size={28} className="text-brand-400 animate-spin" />
      </div>
    );
  }

  /* ================= LOGIN ================= */
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLogin={handleGoogleLogin}
        loading={loading}
        error={authError}
      />
    );
  }

  /* ================= MAIN UI ================= */
  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* ANIMATED SIDEBAR */}
      <AnimatePresence>
        {showChatSidebar && (
          <ChatSidebar
            chats={chats}
            currentChatId={currentChatId}
            onSwitchChat={switchChat}
            onDeleteChat={deleteChat}
            onNewChat={createNewChat}
            onClose={() => setShowChatSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* HEADER */}
      <Header
        onOpenSidebar={() => setShowChatSidebar(true)}
        onNewChat={createNewChat}
        onLogout={handleLogout}
        onClose={() =>
          window.parent.postMessage({ type: "CLOSE_WIDGET" }, "*")
        }
        canAddChat={chats.length < 3}
        currentChatIndex={currentChatIndex}
        totalChats={chats.length}
      />

      {/* PAGE INFO BAR */}
      <AnimatePresence>
        {pageInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <PageInfoBar pageInfo={pageInfo} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAB BAR */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!currentChatId ? (
          /* Empty state — no chats yet */
          <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6">
            <div className="p-4 bg-brand-50 rounded-2xl">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-brand-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">
                No active chat
              </p>
              <p className="text-xs text-slate-400">
                Create a chat to start summarizing and asking questions
              </p>
            </div>
            <Button variant="primary" size="md" onClick={createNewChat}>
              <Plus size={15} />
              New Chat
            </Button>
          </div>
        ) : activeTab === "summary" ? (
          <SummaryView
            summaries={currentSummaries}
            loading={loading}
            hasPageInfo={!!pageInfo}
            onSummarize={generateSummary}
          />
        ) : (
          /* ASK TAB */
          <div className="flex flex-col flex-1 overflow-hidden">
            <MessageList messages={currentMessages} loading={loading} />
            <MessageInput
              onSend={handleAskQuestion}
              disabled={loading || !pageInfo}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================================================
   BOOTSTRAP
================================================================ */
const rootEl = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootEl);
root.render(<Widget />);
