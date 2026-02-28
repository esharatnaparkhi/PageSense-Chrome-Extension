import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { type Message } from "@/types";

interface MessageListProps {
  messages: Message[];
  loading: boolean;
}

export const MessageList = ({ messages, loading }: MessageListProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <ScrollArea className="flex-1" viewportRef={viewportRef}>
      <div className="flex flex-col gap-3 p-3 pb-2">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <p className="text-xs text-center">
              Ask anything about this page
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} index={i} />
        ))}

        {loading && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 size={14} className="text-brand-500 animate-spin" />
            </div>
          </motion.div>
        )}
      </div>
    </ScrollArea>
  );
};
