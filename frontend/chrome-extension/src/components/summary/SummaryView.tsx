import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { SummaryCard } from "@/components/summary/SummaryCard";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { type ChatSummary } from "@/types";

interface SummaryViewProps {
  summaries: ChatSummary[];
  loading: boolean;
  hasPageInfo: boolean;
  onSummarize: () => void;
}

export const SummaryView = ({
  summaries,
  loading,
  hasPageInfo,
  onSummarize,
}: SummaryViewProps) => (
  <div className="flex flex-col h-full">
    <ScrollArea className="flex-1">
      <div className="px-4 flex flex-col">
        <AnimatePresence>
          {summaries.map((sum, i) => (
            <SummaryCard key={`${sum.pageUrl}-${i}`} summary={sum} index={i} />
          ))}
        </AnimatePresence>

        {summaries.length === 0 && !loading && (
          <motion.div
            className="flex flex-col items-center justify-center py-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="text-[42px] font-black text-white/5 leading-none mb-3 tracking-tighter select-none">
              Σ
            </div>
            <p className="text-xs text-white/25 text-center tracking-wide">
              No summaries yet
            </p>
          </motion.div>
        )}
      </div>
    </ScrollArea>

    {hasPageInfo && (
      <div className="px-4 py-3 border-t border-white/[0.06] bg-ps-bg shrink-0">
        <button
          onClick={onSummarize}
          disabled={loading}
          className="w-full h-10 rounded-xl bg-ps-accent text-ps-bg text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-40 disabled:pointer-events-none"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            "Summarize this page"
          )}
        </button>
      </div>
    )}
  </div>
);
