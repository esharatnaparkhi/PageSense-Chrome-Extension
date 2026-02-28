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
  <div className="flex items-center bg-ps-bg border-b border-white/[0.06] px-3 py-2 gap-1 shrink-0">
    {TABS.map(({ id, label, Icon }) => {
      const isActive = activeTab === id;
      return (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 z-0"
          style={{ color: isActive ? "#0B0B0B" : "rgba(255,255,255,0.35)" }}
        >
          {isActive && (
            <motion.div
              layoutId="tab-pill"
              className="absolute inset-0 bg-ps-accent rounded-md"
              style={{ zIndex: -1 }}
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <Icon size={12} />
          {label}
        </button>
      );
    })}
  </div>
);
