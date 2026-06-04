import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
        success: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
        warning: "border-amber-300/20 bg-amber-300/10 text-amber-100",
        muted: "border-white/10 bg-white/[0.05] text-slate-300",
        danger: "border-rose-300/20 bg-rose-300/10 text-rose-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
