import React from "react";
import { type PageInfo } from "@/types";

interface PageInfoBarProps {
  pageInfo: PageInfo;
}

export const PageInfoBar = ({ pageInfo }: PageInfoBarProps) => {
  let hostname = pageInfo.url;
  try {
    hostname = new URL(pageInfo.url).hostname;
  } catch { /* keep raw url */ }

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 bg-ps-bg border-b border-white/[0.06] shrink-0">
      <div className="w-1.5 h-1.5 rounded-full bg-ps-accent shrink-0 shadow-glow-sm" />
      <p className="text-[11px] text-white/40 truncate">
        <span className="text-white/70 font-medium">{hostname}</span>
        {pageInfo.title ? (
          <span className="mx-1.5 text-white/20">·</span>
        ) : null}
        {pageInfo.title && (
          <span className="text-white/35 truncate">{pageInfo.title}</span>
        )}
      </p>
    </div>
  );
};
