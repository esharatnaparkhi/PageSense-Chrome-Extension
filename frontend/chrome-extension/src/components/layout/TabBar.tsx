import React from "react";
import { motion } from "framer-motion";
import { FileText, MessageCircle } from "lucide-react";
import { type ActiveTab } from "@/types";

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const TABS: { id: ActiveTab; label: string; Icon: React.ElementType }[] = [
  { id: "summary", label: "Summary", Icon: FileText },
  { id: "ask", label: "Ask", Icon: MessageCircle },
];

export const TabBar = ({ activeTab, onTabChange }: TabBarProps) => (
  <div className="flex items-center border-b border-slate-100 bg-white shrink-0 px-1">
    {TABS.map(({ id, label, Icon }) => (
      <button
        key={id}
        onClick={() => onTabChange(id)}
        className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
          activeTab === id
            ? "text-brand-600"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <Icon size={14} />
        {label}
        {activeTab === id && (
          <motion.div
            layoutId="tab-indicator"
            className="absolute bottom-0 left-0 right-0 h-0.5 gradient-brand rounded-full"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
      </button>
    ))}
  </div>
);
