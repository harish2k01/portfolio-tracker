import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#00e0c7] text-slate-950 shadow-[0_10px_28px_rgba(0,224,199,0.22)] hover:bg-[#35f3df]",
        secondary:
          "border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]",
        ghost: "text-slate-300 hover:bg-white/[0.07] hover:text-white",
        danger:
          "border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/[0.16]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
