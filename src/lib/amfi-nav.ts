/**
 * Latest NAVs from AMFI's public `NAVAll.txt`, the official daily file every
 * Indian mutual fund NAV is published to. No API key; one download serves
 * every fund for an hour.
 */

export const AMFI_NAV_ALL_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";
const CACHE_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export type AmfiNav = {
  schemeCode: string;
  name: string;
  nav: number;
  /** `YYYY-MM-DD` */
  date: string;
  isins: string[];
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** `20-Nov-2026` → `2026-11-20`; null when it isn't that shape. */
export function parseAmfiDate(value: string) {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value.trim());
  const month = match ? MONTHS[match[2].toLowerCase()] : undefined;

  return match && month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : null;
}

function isIsin(value: string) {
  return /^IN[A-Z0-9]{10}$/.test(value);
}

/**
 * Index `NAVAll.txt` by scheme code. Data rows are `;`-separated with the
 * scheme code first and NAV and date last; heading lines (scheme categories,
 * fund houses) and rows without a usable NAV are skipped.
 */
export function parseNavAll(text: string) {
  const byCode = new Map<string, AmfiNav>();

  for (const rawLine of text.split(/\r?\n/)) {
    const fields = rawLine.split(";").map((field) => field.trim());

    if (fields.length < 6 || !/^\d+$/.test(fields[0])) {
      continue;
    }

    const nav = Number(fields[fields.length - 2]);
    const date = parseAmfiDate(fields[fields.length - 1]);

    if (!Number.isFinite(nav) || nav <= 0 || !date) {
      continue;
    }

    // Newer files add Plan and Option columns after the name; join them so the name reads as AMFI lists it.
    const nameParts = fields.slice(3, fields.length - 2).filter(Boolean);

    byCode.set(fields[0], {
      schemeCode: fields[0],
      name: nameParts.join(" - "),
      nav,
      date,
      isins: [fields[1], fields[2]].filter(isIsin),
    });
  }

  return byCode;
}

let cache: { at: number; byCode: Map<string, AmfiNav> } | null = null;
let inflight: Promise<Map<string, AmfiNav>> | null = null;

async function loadNavAll() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.byCode;
  }

  inflight ??= (async () => {
    try {
      // The file is several MB, too large for Next's data cache, so it is cached here instead.
      const response = await fetch(AMFI_NAV_ALL_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`AMFI returned ${response.status}.`);
      }

      const byCode = parseNavAll(await response.text());
      cache = { at: Date.now(), byCode };
      return byCode;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** The scheme's latest AMFI NAV, or null when AMFI is unreachable or doesn't list it. */
export async function fetchAmfiLatestNav(schemeCode: string) {
  try {
    return (await loadNavAll()).get(schemeCode.trim()) ?? null;
  } catch {
    // Serve a stale copy rather than nothing when a refresh fails.
    return cache?.byCode.get(schemeCode.trim()) ?? null;
  }
}
