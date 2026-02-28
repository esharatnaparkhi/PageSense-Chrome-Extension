import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-ps-bg disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-ps-accent text-ps-bg font-semibold shadow-glow-sm hover:bg-ps-accent-hover active:opacity-80",
        secondary:
          "bg-ps-surface2 text-white hover:bg-white/10 active:bg-white/5",
        ghost:
          "text-white/60 hover:bg-white/10 hover:text-white active:bg-white/5",
        destructive:
          "bg-red-900/30 text-red-400 hover:bg-red-900/50 active:bg-red-900/20",
        outline:
          "border border-white/10 text-white/70 hover:bg-white/5 hover:text-white active:bg-white/10",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8 shrink-0",
        "icon-sm": "h-7 w-7 shrink-0",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
