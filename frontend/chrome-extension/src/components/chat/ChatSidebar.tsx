import React from "react";
import { motion } from "framer-motion";
import { X, MessageSquare, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { type Chat } from "@/types";

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: number | null;
  onSwitchChat: (id: number) => void;
  onDeleteChat: (id: number, e: React.MouseEvent) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export const ChatSidebar = ({
  chats,
  currentChatId,
  onSwitchChat,
  onDeleteChat,
  onNewChat,
  onClose,
}: ChatSidebarProps) => (
  <>
    <motion.div
      className="absolute inset-0 bg-black/50 z-10 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    />

    <motion.div
      className="absolute inset-y-0 left-0 w-[220px] bg-ps-bg z-20 flex flex-col border-r border-white/[0.07]"
      initial={{ x: -224 }}
      animate={{ x: 0 }}
      exit={{ x: -224 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 h-14 border-b border-white/[0.06] shrink-0">
        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-ps-accent rounded-r-full" />
        <span className="text-[10px] font-black tracking-[0.18em] uppercase text-ps-accent ml-2">
          Chats
        </span>
        <Button size="icon-sm" variant="ghost" onClick={onClose}
          className="text-white/30 hover:text-white">
          <X size={14} />
        </Button>
      </div>

      {/* New chat */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <button
          onClick={onNewChat}
          disabled={chats.length >= 3}
          className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-semibold text-white/50 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <Plus size={13} />
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto py-1 px-2">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 text-white/20">
            <p className="text-xs">No chats yet</p>
          </div>
        ) : (
          <div className="space-y-px">
            {chats.map((chat) => {
              const active = chat.id === currentChatId;
              return (
                <motion.div
                  key={chat.id}
                  layout
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100 ${
                    active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  }`}
                  onClick={() => onSwitchChat(chat.id)}
                >
                  {active && (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-ps-accent rounded-r-full" />
                  )}
                  <MessageSquare
                    size={13}
                    className={active ? "text-ps-accent shrink-0" : "text-white/25 shrink-0"}
                  />
                  <span className={`text-xs flex-1 truncate ${active ? "text-white font-semibold" : "text-white/50"}`}>
                    {chat.title}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 shrink-0 text-white/25 hover:text-red-400 hover:bg-red-900/20 rounded"
                    onClick={(e) => onDeleteChat(chat.id, e)}
                  >
                    <Trash2 size={11} />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  </>
);
