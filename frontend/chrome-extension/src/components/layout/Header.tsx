import React from "react";
import { Sparkles, Plus, X, MessageSquare, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onOpenSidebar: () => void;
  onNewChat: () => void;
  onLogout: () => void;
  onClose: () => void;
  canAddChat: boolean;
  currentChatIndex: number;
  totalChats: number;
}

export const Header = ({
  onOpenSidebar,
  onNewChat,
  onLogout,
  onClose,
  canAddChat,
  currentChatIndex,
  totalChats,
}: HeaderProps) => (
  <header className="flex items-center gap-2 px-3 h-12 border-b border-slate-100 bg-white shrink-0">
    <Button
      size="icon-sm"
      variant="ghost"
      onClick={onOpenSidebar}
      title="All chats"
      className="relative"
    >
      <MessageSquare size={16} />
      {totalChats > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-brand-500 text-white text-[9px] flex items-center justify-center font-semibold leading-none">
          {totalChats}
        </span>
      )}
    </Button>

    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <Sparkles size={16} className="text-brand-500 shrink-0" />
      <span className="font-semibold text-sm text-slate-800 text-gradient-brand">
        PageSense
      </span>
      {currentChatIndex > 0 && (
        <span className="text-xs text-slate-400 ml-1">
          Chat {currentChatIndex}/{totalChats}
        </span>
      )}
    </div>

    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onNewChat}
        disabled={!canAddChat}
        title={canAddChat ? "New chat" : "Max 3 chats"}
        className={cn(!canAddChat && "opacity-40")}
      >
        <Plus size={16} />
      </Button>

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onLogout}
        title="Logout"
      >
        <LogOut size={15} />
      </Button>

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onClose}
        title="Close"
      >
        <X size={16} />
      </Button>
    </div>
  </header>
);
