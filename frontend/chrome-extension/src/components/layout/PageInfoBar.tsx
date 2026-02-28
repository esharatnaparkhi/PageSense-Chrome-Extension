import React from "react";
import { Globe } from "lucide-react";
import { type PageInfo } from "@/types";

interface PageInfoBarProps {
  pageInfo: PageInfo;
}

export const PageInfoBar = ({ pageInfo }: PageInfoBarProps) => {
  let hostname = pageInfo.url;
  try {
    hostname = new URL(pageInfo.url).hostname;
  } catch {
    /* keep raw url */
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 shrink-0">
      <Globe size={12} className="text-slate-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-700 truncate leading-tight">
          {pageInfo.title}
        </p>
        <p className="text-[10px] text-slate-400 truncate leading-tight">
          {hostname}
        </p>
      </div>
    </div>
  );
};
