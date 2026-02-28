import React from "react";
import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { type ChatSummary } from "@/types";

interface SummaryCardProps {
  summary: ChatSummary;
  index: number;
}

export const SummaryCard = ({ summary, index }: SummaryCardProps) => {
  let hostname = summary.pageUrl;
  try {
    hostname = new URL(summary.pageUrl).hostname;
  } catch {
    /* keep raw */
  }

  return (
    <motion.div
      className="bg-white border border-slate-100 rounded-2xl p-4 shadow-soft"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="mt-0.5 p-1 bg-brand-50 rounded-lg shrink-0">
          <Globe size={11} className="text-brand-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-700 truncate leading-tight">
            {summary.pageTitle || hostname}
          </p>
          <p className="text-[10px] text-slate-400 truncate leading-tight">
            {hostname}
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
        {summary.summary}
      </p>
    </motion.div>
  );
};
