import { cn } from "@/lib/utils";

export function InvestmentIdentity({
  name,
  subtitle,
  className,
  titleClassName,
}: {
  name: string;
  subtitle?: string | null;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("truncate text-sm font-semibold text-[var(--foreground)]", titleClassName)}>
        {name}
      </p>
      {subtitle ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{subtitle}</p> : null}
    </div>
  );
}
