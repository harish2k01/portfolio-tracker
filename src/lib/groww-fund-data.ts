import {
  fetchAmfiMarketCapClassificationByName,
  type MarketCapClassification,
} from "@/lib/amfi-classification";
import type { AllocationPoint } from "@/lib/allocation-metadata";
import { logoForHoldingName } from "@/lib/investment-logos";

const GROWW_SEARCH_URL = "https://groww.in/v1/api/search/v1/entity";
const GROWW_FUND_URL = "https://groww.in/mutual-funds";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type GrowwSearchResult = {
  entity_type?: string;
  scheme_code?: string;
  search_id?: string;
  title?: string;
};

type GrowwSearchResponse = {
  content?: GrowwSearchResult[];
};

export type GrowwFundHolding = {
  company_name?: string;
  nature_name?: string;
  sector_name?: string;
  instrument_name?: string;
  corpus_per?: number;
};

type GrowwFundData = {
  scheme_code?: string;
  scheme_name?: string;
  category?: string;
  sub_category?: string;
  fund_house?: string;
  holdings?: GrowwFundHolding[];
};

type GrowwNextData = {
  props?: {
    pageProps?: {
      mfServerSideData?: GrowwFundData;
    };
  };
};

export type GrowwFundPortfolio = {
  name?: string;
  category?: string;
  amc?: string;
  holdings?: Array<{ name: string; weight: number; sector?: string; instrument?: string; logoUrl?: string | null }>;
  assetAllocation?: AllocationPoint[];
  sectorAllocation?: AllocationPoint[];
  marketCapAllocation?: AllocationPoint[];
};

const portfolioCache = new Map<
  string,
  { expiresAt: number; value: GrowwFundPortfolio | null }
>();
const pendingPortfolios = new Map<string, Promise<GrowwFundPortfolio | null>>();

export async function fetchGrowwFundPortfolio(
  schemeCode: string,
  schemeName: string,
): Promise<GrowwFundPortfolio | null> {
  const cached = portfolioCache.get(schemeCode);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = pendingPortfolios.get(schemeCode);

  if (pending) {
    return pending;
  }

  const request = loadGrowwFundPortfolio(schemeCode, schemeName)
    .catch(() => null)
    .then((value) => {
      portfolioCache.set(schemeCode, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      pendingPortfolios.delete(schemeCode);
    });

  pendingPortfolios.set(schemeCode, request);
  return request;
}

export async function buildGrowwPortfolioAllocations(
  holdings: GrowwFundHolding[],
  fundName: string,
  category?: string | null,
  classifyCompany: (
    companyName: string,
  ) => Promise<MarketCapClassification | null> = fetchAmfiMarketCapClassificationByName,
) {
  const parentClass = inferParentAssetClass(fundName, category);
  const assetGroups = new Map<string, number>();
  const sectorGroups = new Map<string, number>();
  const marketCapGroups = new Map<string, number>();

  await Promise.all(
    holdings.map(async (holding) => {
      const weight = Number(holding.corpus_per);

      if (!Number.isFinite(weight) || weight <= 0) {
        return;
      }

      const nature = holding.nature_name?.trim() ?? "";
      const assetClass = assetClassFromNature(nature, parentClass);
      assetGroups.set(assetClass, (assetGroups.get(assetClass) ?? 0) + weight);

      if (!isEquityNature(nature)) {
        return;
      }

      const sector = holding.sector_name?.trim();

      if (sector && !/unspecified|unclassified|others?/i.test(sector)) {
        sectorGroups.set(sector, (sectorGroups.get(sector) ?? 0) + weight);
      }

      const companyName = holding.company_name?.trim();
      const marketCap = companyName ? await classifyCompany(companyName) : null;

      if (marketCap) {
        marketCapGroups.set(marketCap, (marketCapGroups.get(marketCap) ?? 0) + weight);
      }
    }),
  );

  return {
    assetAllocation: pointsFromGroups(assetGroups),
    sectorAllocation: pointsFromGroups(sectorGroups),
    marketCapAllocation: pointsFromGroups(marketCapGroups),
  };
}

export function parseGrowwFundPage(html: string) {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );

  if (!match?.[1]) {
    return null;
  }

  try {
    return (JSON.parse(match[1]) as GrowwNextData).props?.pageProps?.mfServerSideData ?? null;
  } catch {
    return null;
  }
}

async function loadGrowwFundPortfolio(schemeCode: string, schemeName: string) {
  const searchId = await resolveGrowwSearchId(schemeCode, schemeName);

  if (!searchId) {
    return null;
  }

  const response = await fetchWithTimeout(
    `${GROWW_FUND_URL}/${encodeURIComponent(searchId)}`,
    10000,
  );

  if (!response.ok) {
    return null;
  }

  const data = parseGrowwFundPage(await response.text());

  if (!data || String(data.scheme_code) !== schemeCode) {
    return null;
  }

  const holdings = data.holdings?.filter(
    (holding) => Number.isFinite(Number(holding.corpus_per)) && Number(holding.corpus_per) > 0,
  ) ?? [];
  const category = [data.category, data.sub_category].filter(Boolean).join(": ");
  const allocations = await buildGrowwPortfolioAllocations(
    holdings,
    data.scheme_name ?? schemeName,
    category,
  );

  return {
    name: data.scheme_name,
    category: category || undefined,
    amc: data.fund_house,
    holdings: holdings
      .map((holding) => {
        const name = holding.company_name?.trim() || "Unknown";

        return {
          name,
          weight: Number(holding.corpus_per),
          sector: holding.sector_name?.trim() || undefined,
          instrument: holding.instrument_name?.trim() || holding.nature_name?.trim() || undefined,
          logoUrl: logoForHoldingName(name),
        };
      }),
    assetAllocation: allocations.assetAllocation,
    sectorAllocation: allocations.sectorAllocation,
    marketCapAllocation: allocations.marketCapAllocation,
  };
}

async function resolveGrowwSearchId(schemeCode: string, schemeName: string) {
  const queries = [
    schemeName,
    schemeName
      .replace(/\b(direct|regular)(?:\s+plan)?\b/gi, " ")
      .replace(/\b(growth|idcw|dividend)(?:\s+(option|plan))?\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ];

  for (const query of [...new Set(queries.filter((value) => value.length >= 2))]) {
    const response = await fetchWithTimeout(
      `${GROWW_SEARCH_URL}?app=false&page=0&query=${encodeURIComponent(query)}&size=20`,
      6000,
    );

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as GrowwSearchResponse;
    const match = payload.content?.find(
      (item) =>
        item.entity_type === "Scheme" &&
        String(item.scheme_code) === schemeCode &&
        item.search_id,
    );

    if (match?.search_id) {
      return match.search_id;
    }
  }

  return null;
}

function inferParentAssetClass(fundName: string, category?: string | null) {
  const text = `${fundName} ${category ?? ""}`.toLowerCase();

  if (/gold|silver|commodity|commodities|metal|metals/.test(text)) {
    return "Commodities";
  }

  if (
    /debt|liquid|overnight|gilt|bond|income|duration|money market|corporate bond|credit risk|floater|ultra short|low duration|banking & psu|banking and psu/.test(
      text,
    )
  ) {
    return "Debt";
  }

  return "Equity";
}

function assetClassFromNature(
  nature: string,
  parentClass: "Equity" | "Debt" | "Commodities",
) {
  if (isEquityNature(nature)) {
    return "Equity";
  }

  if (/cash|debt|bond|money|treasury|certificate|deposit/i.test(nature)) {
    return "Debt";
  }

  if (/commodity|gold|silver|metal/i.test(nature)) {
    return "Commodities";
  }

  return parentClass;
}

function isEquityNature(nature: string) {
  return /equity|realest|reit|invit/i.test(nature);
}

function pointsFromGroups(groups: Map<string, number>) {
  return [...groups.entries()]
    .map(([name, value]) => ({ name, value: Number(value.toFixed(6)) }))
    .filter((point) => point.value > 0)
    .sort((left, right) => right.value - left.value);
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 },
      headers: {
        accept: "application/json,text/html",
        "user-agent": "Mozilla/5.0 Portfolio Tracker",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
