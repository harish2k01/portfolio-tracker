import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] active:scale-[0.99]",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:bg-[var(--primary-hover)]",
        secondary:
          "border border-[var(--line)] bg-[var(--panel)] text-[var(--foreground)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-soft)]",
        ghost: "text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]",
        danger:
          "border border-[var(--negative)]/35 bg-[var(--negative-soft)] text-[var(--negative)] hover:bg-[var(--negative-soft-strong)]",
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
