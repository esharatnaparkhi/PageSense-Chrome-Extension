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
    {/* Overlay */}
    <motion.div
      className="absolute inset-0 bg-black/20 z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    />

    {/* Sidebar panel */}
    <motion.div
      className="absolute inset-y-0 left-0 w-64 bg-white z-20 flex flex-col shadow-medium"
      initial={{ x: -264 }}
      animate={{ x: 0 }}
      exit={{ x: -264 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-slate-100 shrink-0">
        <span className="text-sm font-semibold text-slate-700">Chats</span>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-3 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewChat}
          disabled={chats.length >= 3}
          className="w-full justify-center gap-1.5"
        >
          <Plus size={13} />
          New Chat
        </Button>
        {chats.length >= 3 && (
          <p className="text-[10px] text-slate-400 text-center mt-1">
            Maximum 3 chats
          </p>
        )}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-slate-400">
            <MessageSquare size={24} className="mb-2 opacity-50" />
            <p className="text-xs">No chats yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {chats.map((chat) => (
              <motion.div
                key={chat.id}
                layout
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100 ${
                  chat.id === currentChatId
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => onSwitchChat(chat.id)}
              >
                <MessageSquare
                  size={14}
                  className={
                    chat.id === currentChatId
                      ? "text-brand-500 shrink-0"
                      : "text-slate-400 shrink-0"
                  }
                />
                <span className="text-xs font-medium flex-1 truncate">
                  {chat.title}
                </span>
                {chat.message_count > 0 && (
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {chat.message_count}
                  </span>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                  onClick={(e) => onDeleteChat(chat.id, e)}
                >
                  <Trash2 size={12} />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  </>
);
