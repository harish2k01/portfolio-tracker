import { formatCurrency } from "@/lib/analytics";
import type { NetWorthAssetRow, SipRow } from "@/types/portfolio";

export type AttentionKind = "sip" | "maturity" | "stale";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  /** Days from today; negative means the date has passed. Stale items carry the value's age as a negative number. */
  dueInDays: number;
  href: string;
};

export const SIP_LOOKAHEAD_DAYS = 7;
export const MATURITY_LOOKAHEAD_DAYS = 30;
export const MATURED_LOOKBACK_DAYS = 90;
export const STALE_VALUE_DAYS = 60;

const KIND_ORDER: Record<AttentionKind, number> = { maturity: 0, sip: 1, stale: 2 };

/** Days from `from` to `to`, both `YYYY-MM-DD`, ignoring time zones. */
export function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);

  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export function localIsoDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function formatShortDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function relativeDays(days: number) {
  if (days === 0) {
    return "today";
  }

  if (days === 1) {
    return "tomorrow";
  }

  return `in ${days} days`;
}

/**
 * Things the user should act on soon: SIP debits this week, deposits maturing
 * (or already matured and still tracked), and manually valued assets whose
 * last value is old.
 */
export function buildAttentionItems({
  sips,
  netWorthAssets,
  today = localIsoDate(),
}: {
  sips: SipRow[];
  netWorthAssets: NetWorthAssetRow[];
  today?: string;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const sip of sips) {
    if (sip.status !== "ACTIVE" || !sip.nextDueDate) {
      continue;
    }

    const days = daysBetween(today, sip.nextDueDate);

    if (days < 0 || days > SIP_LOOKAHEAD_DAYS) {
      continue;
    }

    items.push({
      id: `sip-${sip.id}`,
      kind: "sip",
      title: `${formatCurrency(sip.amount)} SIP ${relativeDays(days)}`,
      detail: `${sip.asset.name} · ${formatShortDate(sip.nextDueDate)}`,
      dueInDays: days,
      href: "/sips",
    });
  }

  for (const asset of netWorthAssets) {
    if (asset.type === "FIXED_DEPOSIT" && asset.maturityDate) {
      const days = daysBetween(today, asset.maturityDate);

      if (days >= 0 && days <= MATURITY_LOOKAHEAD_DAYS) {
        items.push({
          id: `maturity-${asset.id}`,
          kind: "maturity",
          title: `${asset.name} matures ${relativeDays(days)}`,
          detail: `${formatCurrency(asset.currentValue)} · ${formatShortDate(asset.maturityDate)} · renew or redeploy`,
          dueInDays: days,
          href: "/assets",
        });
        continue;
      }

      if (days < 0 && -days <= MATURED_LOOKBACK_DAYS) {
        items.push({
          id: `maturity-${asset.id}`,
          kind: "maturity",
          title: `${asset.name} matured ${-days} ${-days === 1 ? "day" : "days"} ago`,
          detail: "Record where the payout went, or remove the deposit",
          dueInDays: days,
          href: "/assets",
        });
        continue;
      }
    }

    const age = daysBetween(asset.asOfDate, today);

    if (age >= STALE_VALUE_DAYS) {
      items.push({
        id: `stale-${asset.id}`,
        kind: "stale",
        title: `${asset.name} value is ${age} days old`,
        detail: `Last updated ${formatShortDate(asset.asOfDate)} · add the current balance`,
        dueInDays: -age,
        href: "/assets",
      });
    }
  }

  return items.sort((a, b) => {
    if (a.kind !== b.kind) {
      return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    }

    return a.dueInDays - b.dueInDays;
  });
}
