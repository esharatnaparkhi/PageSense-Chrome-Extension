export interface Chat {
  id: number;
  title: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  pageUrl?: string | null;
  pageTitle?: string | null;
  sources?: SourceReference[] | null;
  type?: string | null;
}

export interface SourceReference {
  chunk_id: string;
  score: number;
  selector?: string | null;
  text: string;
}

export interface PageInfo {
  url: string;
  title: string;
}

export interface ChatSummary {
  pageUrl: string;
  pageTitle: string;
  summary: string;
  timestamp: string | null;
}

export interface TextChunk {
  id: string;
  text: string;
  start_char: number;
  end_char: number;
  dom_selector?: string | null;
}

export type ActiveTab = "summary" | "ask";

export interface Session {
  currentChatId?: number | null;
  pageChunks?: Record<string, TextChunk[]>;
}
