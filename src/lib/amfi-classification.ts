import * as XLSX from "xlsx";

const AMFI_CLASSIFICATION_PAGE =
  "https://www.amfiindia.com/otherdata/categorisation-of-stocks";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type MarketCapClassification = "Large Cap" | "Mid Cap" | "Small Cap";

let classificationCache:
  | {
      expiresAt: number;
      values: Map<string, MarketCapClassification>;
    }
  | undefined;
let pendingClassification: Promise<Map<string, MarketCapClassification>> | undefined;

export async function fetchAmfiMarketCapClassification(
  isin?: string | null,
): Promise<MarketCapClassification | null> {
  const normalizedIsin = isin?.trim().toUpperCase();

  if (!normalizedIsin) {
    return null;
  }

  try {
    const values = await getClassificationMap();
    return values.get(normalizedIsin) ?? null;
  } catch {
    return null;
  }
}

export function parseAmfiClassificationWorkbook(
  input: ArrayBuffer | Buffer,
): Map<string, MarketCapClassification> {
  const workbook = XLSX.read(input instanceof ArrayBuffer ? new Uint8Array(input) : input);
  const values = new Map<string, MarketCapClassification>();

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    });
    const headerIndex = rows.findIndex((row) => {
      const headers = row.map(normalizeHeader);
      return headers.includes("isin") && headers.some((header) => header.includes("categorization"));
    });

    if (headerIndex === -1) {
      continue;
    }

    const headers = rows[headerIndex].map(normalizeHeader);
    const isinIndex = headers.indexOf("isin");
    const categoryIndex = headers.findIndex((header) => header.includes("categorization"));

    for (const row of rows.slice(headerIndex + 1)) {
      const isin = String(row[isinIndex] ?? "").trim().toUpperCase();
      const category = normalizeCategory(String(row[categoryIndex] ?? ""));

      if (isin && category) {
        values.set(isin, category);
      }
    }
  }

  return values;
}

async function getClassificationMap() {
  if (classificationCache && classificationCache.expiresAt > Date.now()) {
    return classificationCache.values;
  }

  if (!pendingClassification) {
    pendingClassification = loadClassificationMap().finally(() => {
      pendingClassification = undefined;
    });
  }

  return pendingClassification;
}

async function loadClassificationMap() {
  const pageResponse = await fetchWithTimeout(AMFI_CLASSIFICATION_PAGE, 8000);

  if (!pageResponse.ok) {
    throw new Error(`AMFI classification page returned ${pageResponse.status}.`);
  }

  const page = await pageResponse.text();
  const workbookUrl = findLatestWorkbookUrl(page);

  if (!workbookUrl) {
    throw new Error("AMFI classification workbook was not found.");
  }

  const workbookResponse = await fetchWithTimeout(workbookUrl, 12000);

  if (!workbookResponse.ok) {
    throw new Error(`AMFI classification workbook returned ${workbookResponse.status}.`);
  }

  const values = parseAmfiClassificationWorkbook(await workbookResponse.arrayBuffer());
  classificationCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    values,
  };

  return values;
}

function findLatestWorkbookUrl(page: string) {
  const matches = [
    ...page.matchAll(
      /https:\/\/www\.amfiindia\.com\/[^"'\\\s]+(?:Average|Avg)[^"'\\]*?\.xlsx/gi,
    ),
  ].map((match) => match[0].trim());
  const unique = [...new Set(matches)];

  return unique.sort((left, right) => workbookScore(right) - workbookScore(left))[0] ?? null;
}

function workbookScore(url: string) {
  const decoded = decodeURIComponent(url).toLowerCase();
  const years = [...decoded.matchAll(/20\d{2}/g)].map((match) => Number(match[0]));
  const year = years.length ? Math.max(...years) : 0;
  const period = /31\s*dec|jul\s*-\s*dec|jul-dec/.test(decoded)
    ? 2
    : /30\s*jun|jan\s*-\s*jun|jan-june/.test(decoded)
      ? 1
      : 0;

  return year * 10 + period;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeCategory(value: string): MarketCapClassification | null {
  if (/large/i.test(value)) {
    return "Large Cap";
  }

  if (/mid/i.test(value)) {
    return "Mid Cap";
  }

  if (/small|micro/i.test(value)) {
    return "Small Cap";
  }

  return null;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 },
    });
  } finally {
    clearTimeout(timeout);
  }
}
