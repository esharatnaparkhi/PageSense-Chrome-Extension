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
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  return (
    <ScrollArea className="flex-1 min-h-0" viewportRef={viewportRef}>
      <div className="flex flex-col gap-4 px-4 py-4 pb-3">
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-24">
            <p className="text-xs text-white/20 tracking-wide">
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
            <div className="flex gap-2.5 items-center">
              <div className="w-0.5 h-5 bg-ps-accent/30 rounded-full" />
              <Loader2 size={13} className="text-ps-accent animate-spin" />
            </div>
          </motion.div>
        )}
      </div>
    </ScrollArea>
  );
};
