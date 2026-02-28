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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "gradient-brand text-white rounded-br-sm shadow-soft"
            : "bg-slate-100 text-slate-800 rounded-bl-sm"
        }`}
      >
        {message.pageTitle && isUser && (
          <p
            className="text-[10px] mb-1 opacity-70 truncate"
            title={message.pageTitle}
          >
            {message.pageTitle}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </motion.div>
  );
};
