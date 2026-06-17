"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { Landmark, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/types/portfolio";

type InvestmentIconProps = {
  name: string;
  type?: AssetType;
  symbol?: string | null;
  amc?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

type InvestmentIdentityProps = InvestmentIconProps & {
  subtitle?: string | null;
  titleClassName?: string;
  subtitleClassName?: string;
};

const stockDomains: Array<[RegExp, string]> = [
  [/\bhdfc bank\b/i, "hdfcbank.com"],
  [/\bicici bank\b/i, "icicibank.com"],
  [/\breliance\b/i, "ril.com"],
  [/\bbharti airtel\b|\bairtel\b/i, "airtel.in"],
  [/\bitc\b/i, "itcportal.com"],
  [/\binfosys\b/i, "infosys.com"],
  [/\bstate bank\b|\bsbi\b/i, "sbi.co.in"],
  [/\baxis bank\b/i, "axisbank.com"],
  [/\bkotak mahindra\b|\bkotak\b/i, "kotak.com"],
  [/\bpower grid\b/i, "powergrid.in"],
  [/\bcoal india\b/i, "coalindia.in"],
  [/\bmahindra\b/i, "mahindra.com"],
  [/\bhcl technologies\b|\bhcltech\b/i, "hcltech.com"],
  [/\blarsen\b|\bl&t\b|\bltimindtree\b/i, "larsentoubro.com"],
  [/\btata consultancy\b|\btcs\b/i, "tcs.com"],
  [/\btata\b/i, "tata.com"],
  [/\bbajaj\b/i, "bajajfinserv.in"],
  [/\bmaruti\b/i, "marutisuzuki.com"],
  [/\bhindustan unilever\b|\bhul\b/i, "hul.co.in"],
  [/\btitan\b/i, "titancompany.in"],
  [/\bsun pharma\b/i, "sunpharma.com"],
  [/\basian paints\b/i, "asianpaints.com"],
  [/\bwipro\b/i, "wipro.com"],
  [/\bnestle\b/i, "nestle.in"],
  [/\bultratech\b/i, "ultratechcement.com"],
  [/\bjsw\b/i, "jsw.in"],
  [/\bntpc\b/i, "ntpc.co.in"],
  [/\bongc\b/i, "ongcindia.com"],
  [/\bhindalco\b/i, "hindalco.com"],
  [/\btech mahindra\b/i, "techmahindra.com"],
  [/\bcipla\b/i, "cipla.com"],
  [/\bdr reddy\b/i, "drreddys.com"],
  [/\bapollo hospitals\b/i, "apollohospitals.com"],
  [/\badani\b/i, "adani.com"],
];

const amcDomains: Array<[RegExp, string]> = [
  [/\bparag parikh\b|\bppfas\b/i, "amc.ppfas.com"],
  [/\bhdfc\b/i, "hdfcfund.com"],
  [/\buti\b/i, "utimf.com"],
  [/\bmotilal oswal\b/i, "motilaloswalmf.com"],
  [/\bedelweiss\b/i, "edelweissmf.com"],
  [/\bnippon\b/i, "nipponindiamf.com"],
  [/\bicici prudential\b/i, "icicipruamc.com"],
  [/\bsbi\b/i, "sbimf.com"],
  [/\baxis\b/i, "axismf.com"],
  [/\bkotak\b/i, "kotakmf.com"],
  [/\bquant\b/i, "quantmutual.com"],
  [/\bnavi\b/i, "navimutualfund.com"],
  [/\bdsp\b/i, "dspim.com"],
  [/\bmirae\b/i, "miraeassetmf.co.in"],
  [/\bcanara robeco\b/i, "canararobeco.com"],
  [/\baditya birla\b/i, "mutualfund.adityabirlacapital.com"],
  [/\bfranklin\b/i, "franklintempletonindia.com"],
  [/\binvesco\b/i, "invescomutualfund.com"],
  [/\bhsbc\b/i, "assetmanagement.hsbc.co.in"],
  [/\bbandhan\b/i, "bandhanmutual.com"],
  [/\bwhiteoak\b/i, "whiteoakamc.com"],
  [/\bjm\b/i, "jmfinancialmf.com"],
  [/\bbaroda bnp\b/i, "barodabnpparibasmf.in"],
  [/\bpgim\b/i, "pgimindiamf.com"],
  [/\btata\b/i, "tatamutualfund.com"],
];

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
  name,
  type,
  symbol,
  amc,
  size = "sm",
  className,
}: InvestmentIconProps) {
  const domain = useMemo(() => resolveIconDomain({ name, type, symbol, amc }), [amc, name, symbol, type]);
  const [failedDomain, setFailedDomain] = useState<string | null>(null);
  const showImage = domain && failedDomain !== domain;
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
          src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`}
          alt=""
          loading="lazy"
          className={cn("object-contain", imageSizeClasses[size])}
          onError={() => setFailedDomain(domain)}
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
  amc,
  size = "sm",
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
}: InvestmentIdentityProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <InvestmentIcon name={name} type={type} symbol={symbol} amc={amc} size={size} />
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

function resolveIconDomain({
  name,
  type,
  symbol,
  amc,
}: {
  name: string;
  type?: AssetType;
  symbol?: string | null;
  amc?: string | null;
}) {
  const searchText = `${name} ${symbol ?? ""} ${amc ?? ""}`;
  const domainList =
    type === "MUTUAL_FUND"
      ? amcDomains
      : type === "ETF"
        ? [...amcDomains, ...stockDomains]
        : stockDomains;
  const match = domainList.find(([pattern]) => pattern.test(searchText));

  return match?.[1] ?? null;
}
