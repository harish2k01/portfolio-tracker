import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-blue-600/25 bg-blue-500/10 text-blue-700",
        success: "border-emerald-200/30 bg-emerald-300/14 text-emerald-50",
        warning: "border-amber-200/30 bg-amber-300/14 text-amber-50",
        muted: "border-slate-200/15 bg-white/[0.07] text-slate-200",
        danger: "border-rose-200/30 bg-rose-300/14 text-rose-50",
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
