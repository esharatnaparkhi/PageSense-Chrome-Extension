import React from "react";
import * as RadixScrollArea from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

interface ScrollAreaProps {
  className?: string;
  children: React.ReactNode;
  viewportRef?: React.RefObject<HTMLDivElement>;
}

export const ScrollArea = ({ className, children, viewportRef }: ScrollAreaProps) => (
  <RadixScrollArea.Root
    className={cn("relative overflow-hidden", className)}
    type="hover"
  >
    <RadixScrollArea.Viewport
      ref={viewportRef}
      className="h-full w-full rounded-[inherit]"
    >
      {children}
    </RadixScrollArea.Viewport>
    <RadixScrollArea.Scrollbar
      className="flex touch-none select-none transition-colors duration-150 ease-out data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-1.5"
      orientation="vertical"
    >
      <RadixScrollArea.Thumb className="relative flex-1 rounded-full bg-ps-surface2 hover:bg-ps-accent/30 transition-colors" />
    </RadixScrollArea.Scrollbar>
    <RadixScrollArea.Corner />
  </RadixScrollArea.Root>
);
