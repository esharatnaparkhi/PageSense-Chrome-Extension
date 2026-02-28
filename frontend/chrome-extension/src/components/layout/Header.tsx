import React from "react";
import { Plus, X, AlignLeft, LogOut } from "lucide-react";
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
  <header className="relative flex items-center gap-3 px-4 h-14 bg-ps-surface shrink-0 border-b border-white/[0.06]">
    {/* Yellow left accent stripe */}
    <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-ps-accent rounded-r-full" />

    <Button
      size="icon-sm"
      variant="ghost"
      onClick={onOpenSidebar}
      title="All chats"
      className="relative ml-1.5 text-white/50 hover:text-white"
    >
      <AlignLeft size={16} />
      {totalChats > 0 && (
        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-ps-accent text-ps-bg text-[9px] flex items-center justify-center font-black leading-none">
          {totalChats}
        </span>
      )}
    </Button>

    <div className="flex flex-col flex-1 min-w-0">
      <span className="text-[10px] font-black tracking-[0.18em] uppercase text-ps-accent leading-none">
        PageSense
      </span>
      {currentChatIndex > 0 ? (
        <span className="text-[10px] text-white/25 leading-none mt-[3px]">
          chat {currentChatIndex}/{totalChats}
        </span>
      ) : (
        <span className="text-[10px] text-white/25 leading-none mt-[3px]">
          ai reading assistant
        </span>
      )}
    </div>

    <div className="flex items-center gap-0.5">
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onNewChat}
        disabled={!canAddChat}
        title={canAddChat ? "New chat" : "Max 3 chats"}
        className={cn("text-white/40 hover:text-white", !canAddChat && "opacity-25")}
      >
        <Plus size={15} />
      </Button>

      <Button size="icon-sm" variant="ghost" onClick={onLogout} title="Logout"
        className="text-white/40 hover:text-white">
        <LogOut size={14} />
      </Button>

      <Button size="icon-sm" variant="ghost" onClick={onClose} title="Close"
        className="text-white/40 hover:text-white">
        <X size={15} />
      </Button>
    </div>
  </header>
);
