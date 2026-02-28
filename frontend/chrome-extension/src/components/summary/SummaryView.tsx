import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
      <div className="p-3 flex flex-col gap-3">
        <AnimatePresence>
          {summaries.map((sum, i) => (
            <SummaryCard key={`${sum.pageUrl}-${i}`} summary={sum} index={i} />
          ))}
        </AnimatePresence>

        {summaries.length === 0 && !loading && (
          <motion.div
            className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="p-3 bg-slate-50 rounded-2xl">
              <FileText size={24} className="text-slate-300" />
            </div>
            <p className="text-xs text-center text-slate-400">
              No summaries yet.
              <br />
              Click the button below to summarize this page.
            </p>
          </motion.div>
        )}
      </div>
    </ScrollArea>

    {hasPageInfo && (
      <div className="px-3 py-3 border-t border-slate-100 bg-white shrink-0">
        <Button
          variant="primary"
          size="lg"
          onClick={onSummarize}
          disabled={loading}
          className="w-full justify-center"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <>
              <Sparkles size={15} />
              Summarize Current Page
            </>
          )}
        </Button>
      </div>
    )}
  </div>
);
