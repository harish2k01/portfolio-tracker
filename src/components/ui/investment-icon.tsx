"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { Landmark, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types/portfolio";

type InvestmentIconProps = {
  name: string;
  type?: AssetType;
  symbol?: string | null;
  isin?: string | null;
  amc?: string | null;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

type InvestmentIdentityProps = InvestmentIconProps & {
  subtitle?: string | null;
  titleClassName?: string;
  subtitleClassName?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-lg",
  lg: "h-12 w-12 rounded-xl",
};

const imageSizeClasses = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function InvestmentIcon({
  type,
  logoUrl,
  size = "sm",
  className,
}: InvestmentIconProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showImage = Boolean(logoUrl && failedLogoUrl !== logoUrl);
  const FallbackIcon = type === "MUTUAL_FUND" ? Landmark : LineChart;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border border-[var(--line)] bg-[var(--panel-soft)] text-[var(--primary)]",
        sizeClasses[size],
        className,
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={logoUrl ?? ""}
          alt=""
          loading="lazy"
          className={cn("object-contain", imageSizeClasses[size])}
          onError={() => setFailedLogoUrl(logoUrl ?? null)}
        />
      ) : (
        <FallbackIcon className={cn(imageSizeClasses[size])} aria-hidden />
      )}
    </span>
  );
}

export function InvestmentIdentity({
  name,
  type,
  symbol,
  isin,
  amc,
  logoUrl,
  size = "sm",
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
}: InvestmentIdentityProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <InvestmentIcon
        name={name}
        type={type}
        symbol={symbol}
        isin={isin}
        amc={amc}
        logoUrl={logoUrl}
        size={size}
      />
      <span className="min-w-0">
        <span className={cn("block truncate text-sm font-semibold text-[var(--foreground)]", titleClassName)}>
          {name}
        </span>
        {subtitle ? (
          <span className={cn("mt-1 block truncate text-xs text-[var(--muted)]", subtitleClassName)}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
