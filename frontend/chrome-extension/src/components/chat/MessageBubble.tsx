import React from "react";
import { motion } from "framer-motion";
import { type Message } from "@/types";

interface MessageBubbleProps {
  message: Message;
  index: number;
}

export const MessageBubble = ({ message, index }: MessageBubbleProps) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.25) }}
    >
      {isUser ? (
        <div className="max-w-[82%] bg-ps-accent rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm text-ps-bg font-medium leading-relaxed">
          {message.pageTitle && (
            <p className="text-[10px] opacity-50 mb-1 truncate font-normal">
              {message.pageTitle}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      ) : (
        <div className="max-w-[88%] flex gap-2.5">
          {/* Yellow accent bar */}
          <div className="w-0.5 bg-ps-accent/40 rounded-full shrink-0 mt-0.5 mb-0.5" />
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words py-0.5">
            {message.content}
          </p>
        </div>
      )}
    </motion.div>
  );
};
