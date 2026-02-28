import React from "react";
import { motion } from "framer-motion";
import { type ChatSummary } from "@/types";

interface SummaryCardProps {
  summary: ChatSummary;
  index: number;
}

export const SummaryCard = ({ summary, index }: SummaryCardProps) => {
  let hostname = summary.pageUrl;
  try {
    hostname = new URL(summary.pageUrl).hostname;
  } catch { /* keep raw */ }

  return (
    <motion.div
      className="flex gap-3 py-4 border-b border-white/[0.06] last:border-0"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.07 }}
    >
      {/* Index column */}
      <div className="shrink-0 pt-0.5">
        <span className="text-[10px] font-black text-ps-accent/50 tabular-nums w-4 block">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-semibold text-ps-accent/70 uppercase tracking-wider truncate">
            {hostname}
          </span>
        </div>
        {summary.pageTitle && hostname !== summary.pageTitle && (
          <p className="text-xs font-semibold text-white mb-1.5 truncate leading-tight">
            {summary.pageTitle}
          </p>
        )}
        <p className="text-[13px] text-white/60 leading-relaxed">
          {summary.summary}
        </p>
      </div>
    </motion.div>
  );
};
