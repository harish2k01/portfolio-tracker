import type { AssetType } from "@prisma/client";

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL";

export type InvestmentSearchResult = {
  name: string;
  type: AssetType;
  symbol?: string;
  schemeCode?: string;
  isin?: string;
  exchange?: string;
  category?: string;
  amc?: string;
};

export type PricePoint = {
  date: string;
  value: number;
};

export type DatedPricePoint = PricePoint & {
  dateValue: number;
};

export type InvestmentQuote = {
  name: string;
  type: AssetType;
  symbol?: string;
  schemeCode?: string;
  exchange?: string;
  category?: string;
  amc?: string;
  value: number | null;
  changePercent: number | null;
  history: PricePoint[];
  holdings?: Array<{ name: string; weight: number }>;
  sectorAllocation?: Array<{ name: string; value: number }>;
  marketCapAllocation?: Array<{ name: string; value: number }>;
};

type MfSearchResult = {
  schemeCode?: number | string;
  schemeName?: string;
  schemeCategory?: string;
  fundHouse?: string;
};

type MfApiResponse = {
  meta?: {
    fund_house?: string;
    scheme_type?: string;
    scheme_category?: string;
    scheme_code?: number | string;
    scheme_name?: string;
  };
  data?: Array<{
    date: string;
    nav: string;
  }>;
};

type YahooSearchResponse = {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    exchange?: string;
    quoteType?: string;
  }>;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        symbol?: string;
        shortName?: string;
        longName?: string;
        exchangeName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type YahooQuoteSummaryResponse = {
  quoteSummary?: {
    result?: Array<{
      assetProfile?: {
        sector?: string;
      };
      price?: {
        marketCap?: {
          raw?: number;
        };
      };
    }>;
  };
};

type MfDataScheme = {
  data?: {
    name?: string;
    nav?: number;
    category?: string;
    amc?: string;
    expense_ratio?: number;
    holdings?: Array<{ name?: string; company?: string; weight?: number; percentage?: number }>;
    sectors?: Array<{ name?: string; sector?: string; weight?: number; percentage?: number }>;
    market_cap?: Record<string, number>;
  };
};

const yahooRangeMap: Record<ChartRange, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "1W": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "3Y": { range: "3y", interval: "1wk" },
  "5Y": { range: "5y", interval: "1wk" },
  ALL: { range: "max", interval: "1mo" },
};

const mfDaysMap: Record<Exclude<ChartRange, "1D">, number> = {
  "1W": 7,
  "1M": 31,
  "3M": 93,
  "6M": 186,
  "1Y": 366,
  "3Y": 366 * 3,
  "5Y": 366 * 5,
  ALL: 36500,
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseMfDate(value: string) {
  const [day, month, year] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatChartDate(timestamp: number, range: ChartRange) {
  return new Date(timestamp * 1000).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    ...(range === "1D" ? { hour: "2-digit", minute: "2-digit" } : {}),
    ...(range === "3Y" || range === "5Y" || range === "ALL" ? { year: "2-digit" } : {}),
  });
}

function yahooDateString(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function yahooAssetType(quoteType?: string, name = ""): AssetType {
  if (quoteType === "ETF" || /\bETF\b|BEES/i.test(name)) {
    return "ETF";
  }

  return "STOCK";
}

function isIndiaYahooSymbol(symbol?: string) {
  return Boolean(symbol?.endsWith(".NS") || symbol?.endsWith(".BO"));
}

function normalizeFundFamily(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(direct|regular)\s+plan\b/g, "")
    .replace(/\b(growth|idcw|dividend)\s+(option|plan)?\b/g, "")
    .replace(/\b(option|plan|fund|scheme)\b/g, "")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fundVariantScore(name: string) {
  let score = 0;

  if (/\bdirect\s+plan\b/i.test(name)) {
    score += 40;
  }

  if (/\bgrowth\b/i.test(name)) {
    score += 30;
  }

  if (/\bregular\s+plan\b/i.test(name)) {
    score -= 20;
  }

  if (/\bIDCW\b|\bdividend\b/i.test(name)) {
    score -= 35;
  }

  return score;
}

export async function searchMutualFunds(query: string): Promise<InvestmentSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }

  let response: Response;

  try {
    response = await fetch(
      `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query.trim())}`,
      { next: { revalidate: 60 * 60 * 12 } },
    );
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as MfSearchResult[];
  const normalized = data
    .map((item) => ({
      name: item.schemeName ?? `Scheme ${item.schemeCode}`,
      type: "MUTUAL_FUND" as const,
      schemeCode: item.schemeCode ? String(item.schemeCode) : undefined,
      category: item.schemeCategory,
      amc: item.fundHouse,
    }))
    .filter((item) => !/\bETF\b|\bBEES\b/i.test(item.name))
    .sort((a, b) => fundVariantScore(b.name) - fundVariantScore(a.name));
  const byFamily = new Map<string, InvestmentSearchResult>();

  for (const item of normalized) {
    const family = normalizeFundFamily(item.name);

    if (!byFamily.has(family)) {
      byFamily.set(family, item);
    }
  }

  return [...byFamily.values()].slice(0, 8);
}

export async function searchStocksAndEtfs(query: string): Promise<InvestmentSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }

  let response: Response;

  try {
    response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        query.trim(),
      )}&quotesCount=12&newsCount=0`,
      { next: { revalidate: 60 * 15 } },
    );
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as YahooSearchResponse;

  return (
    data.quotes
      ?.filter((quote) => isIndiaYahooSymbol(quote.symbol))
      .filter((quote) => quote.quoteType === "EQUITY" || quote.quoteType === "ETF")
      .slice(0, 8)
      .map((quote) => {
        const name = quote.longname ?? quote.shortname ?? quote.symbol ?? "Unknown";

        return {
          name,
          type: yahooAssetType(quote.quoteType, name),
          symbol: quote.symbol,
          exchange: quote.exchDisp ?? quote.exchange,
          category: quote.quoteType === "ETF" ? "ETF" : "Equity",
        };
      }) ?? []
  );
}

export async function searchInvestments(query: string) {
  const [funds, equities] = await Promise.all([
    searchMutualFunds(query),
    searchStocksAndEtfs(query),
  ]);

  return [...funds, ...equities].slice(0, 12);
}

export async function fetchMutualFundDetails(
  schemeCode: string,
  range: Exclude<ChartRange, "1D"> = "1Y",
): Promise<InvestmentQuote> {
  const days = mfDaysMap[range];
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const enrichedPromise = withFallbackTimeout(fetchMfDataDetails(schemeCode), 1800, null);
  const payload = await fetchMfApiHistory(schemeCode, startDate, endDate);
  const points =
    payload.data
      ?.map((point) => ({
        dateValue: parseMfDate(point.date).getTime(),
        date: point.date,
        value: Number(point.nav),
      }))
      .filter((point) => Number.isFinite(point.value))
      .filter((point) => point.dateValue >= startDate.getTime() && point.dateValue <= endDate.getTime())
      .sort((a, b) => a.dateValue - b.dateValue)
      .map(({ date, value }) => ({ date, value })) ?? [];
  const enriched = await enrichedPromise;
  const latest = points.at(-1)?.value ?? enriched?.value ?? null;
  const first = points.at(0)?.value ?? latest;

  return {
    name: payload.meta?.scheme_name ?? enriched?.name ?? `Scheme ${schemeCode}`,
    type: "MUTUAL_FUND",
    schemeCode,
    amc: payload.meta?.fund_house ?? enriched?.amc,
    category: payload.meta?.scheme_category ?? enriched?.category,
    value: latest,
    changePercent: latest && first ? ((latest - first) / first) * 100 : null,
    history: points,
    holdings: enriched?.holdings,
    sectorAllocation: enriched?.sectorAllocation,
    marketCapAllocation: enriched?.marketCapAllocation,
  };
}

export async function fetchHistoricalInvestmentPrices(input: {
  type: AssetType;
  schemeCode?: string | null;
  symbol?: string | null;
  startDate: Date;
  endDate: Date;
}): Promise<DatedPricePoint[]> {
  if (input.type === "MUTUAL_FUND") {
    if (!input.schemeCode) {
      throw new Error("Mutual fund scheme code is required.");
    }

    const payload = await fetchMfApiHistory(input.schemeCode, input.startDate, input.endDate);

    return (
      payload.data
        ?.map((point) => {
          const dateValue = parseMfDate(point.date).getTime();

          return {
            dateValue,
            date: new Date(dateValue).toISOString().slice(0, 10),
            value: Number(point.nav),
          };
        })
        .filter(
          (point) =>
            Number.isFinite(point.value) &&
            point.dateValue >= input.startDate.getTime() &&
            point.dateValue <= input.endDate.getTime(),
        )
        .sort((a, b) => a.dateValue - b.dateValue) ?? []
    );
  }

  if (!input.symbol) {
    throw new Error("Symbol is required.");
  }

  const start = Math.floor(input.startDate.getTime() / 1000);
  const end = Math.floor(input.endDate.getTime() / 1000);
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      input.symbol,
    )}?period1=${start}&period2=${end}&interval=1d`,
    { next: { revalidate: 60 * 60 } },
  );

  if (!response.ok) {
    throw new Error("Unable to fetch historical prices.");
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((timestamp, index) => ({
      dateValue: timestamp * 1000,
      date: yahooDateString(timestamp),
      value: closes[index],
    }))
    .filter((point): point is DatedPricePoint => typeof point.value === "number")
    .sort((a, b) => a.dateValue - b.dateValue);
}

async function fetchMfApiHistory(schemeCode: string, startDate: Date, endDate: Date) {
  const urls = [
    `https://api.mfapi.in/mf/${schemeCode}?startDate=${toDateString(
      startDate,
    )}&endDate=${toDateString(endDate)}`,
    `https://api.mfapi.in/mf/${schemeCode}`,
  ];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const response = await fetch(url, { next: { revalidate: 60 * 60 * 6 } });

      if (response.ok) {
        return (await response.json()) as MfApiResponse;
      }

      lastError = new Error(`MFAPI returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to fetch mutual fund data.");
}

export async function fetchYahooDetails(
  symbol: string,
  type: AssetType,
  range: ChartRange = "1Y",
): Promise<InvestmentQuote> {
  const config = yahooRangeMap[range];
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${config.range}&interval=${config.interval}`,
    { next: { revalidate: range === "1D" ? 60 : 60 * 15 } },
  );

  if (!response.ok) {
    throw new Error("Unable to fetch Yahoo Finance data.");
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const history = timestamps
    .map((timestamp, index) => ({
      date: formatChartDate(timestamp, range),
      value: closes[index],
    }))
    .filter((point): point is PricePoint => typeof point.value === "number");
  const latest = result?.meta?.regularMarketPrice ?? history.at(-1)?.value ?? null;
  const previous = result?.meta?.chartPreviousClose ?? history.at(0)?.value ?? latest;
  const summary = await fetchYahooSummary(symbol);

  return {
    name: result?.meta?.longName ?? result?.meta?.shortName ?? symbol,
    type,
    symbol,
    exchange: result?.meta?.exchangeName,
    category: type === "ETF" ? "ETF" : "Equity",
    value: latest,
    changePercent: latest && previous ? ((latest - previous) / previous) * 100 : null,
    history,
    sectorAllocation: summary.sector ? [{ name: summary.sector, value: 100 }] : undefined,
    marketCapAllocation: summary.marketCap ? [{ name: marketCapBucket(summary.marketCap), value: 100 }] : undefined,
  };
}

export async function fetchInvestmentDetails(
  input: {
    type: AssetType;
    schemeCode?: string | null;
    symbol?: string | null;
  },
  range: ChartRange = "1Y",
) {
  if (input.type === "MUTUAL_FUND") {
    if (!input.schemeCode) {
      throw new Error("Mutual fund scheme code is required.");
    }

    return fetchMutualFundDetails(input.schemeCode, range === "1D" ? "1W" : range);
  }

  if (!input.symbol) {
    throw new Error("Stock or ETF symbol is required.");
  }

  return fetchYahooDetails(input.symbol, input.type, range);
}

export async function fetchPriceOnDate(input: {
  type: AssetType;
  schemeCode?: string | null;
  symbol?: string | null;
  date: string;
}) {
  const requested = new Date(input.date);

  if (input.type === "MUTUAL_FUND") {
    if (!input.schemeCode) {
      throw new Error("Mutual fund scheme code is required.");
    }

    const start = new Date(requested);
    start.setDate(start.getDate() - 7);
    const end = new Date(requested);
    end.setDate(end.getDate() + 3);
    const payload = await fetchMfApiHistory(input.schemeCode, start, end);
    const sorted =
      payload.data
        ?.map((point) => ({
          dateValue: parseMfDate(point.date).getTime(),
          value: Number(point.nav),
        }))
        .filter((point) => point.dateValue <= requested.getTime())
        .sort((a, b) => b.dateValue - a.dateValue) ?? [];

    const value = sorted[0]?.value;

    if (!value) {
      throw new Error("NAV is unavailable for the selected date.");
    }

    return value;
  }

  if (!input.symbol) {
    throw new Error("Symbol is required.");
  }

  const startDate = new Date(input.date);
  startDate.setDate(startDate.getDate() - 5);
  const endDate = new Date(input.date);
  endDate.setDate(endDate.getDate() + 2);
  const start = Math.floor(startDate.getTime() / 1000);
  const end = Math.floor(endDate.getTime() / 1000);
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      input.symbol,
    )}?period1=${start}&period2=${end}&interval=1d`,
    { next: { revalidate: 60 * 60 } },
  );

  if (!response.ok) {
    const fallback = await fetchYahooDetails(input.symbol, input.type, "1M");

    if (fallback.value) {
      return fallback.value;
    }

    throw new Error("Unable to fetch price for date.");
  }

  const payload = (await response.json()) as YahooChartResponse;
  const closes = payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  const value = closes.filter((point): point is number => typeof point === "number").at(-1);

  if (!value) {
    const fallback = await fetchYahooDetails(input.symbol, input.type, "1M");

    if (fallback.value) {
      return fallback.value;
    }

    throw new Error("Price is unavailable for the selected date.");
  }

  return value;
}

async function fetchMfDataDetails(schemeCode: string) {
  try {
    const response = await fetch(`https://mfdata.in/api/v1/schemes/${schemeCode}`, {
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as MfDataScheme;
    const data = payload.data;

    if (!data) {
      return null;
    }

    return {
      name: data.name,
      value: toNumber(data.nav) ?? undefined,
      amc: data.amc,
      category: data.category,
      holdings: data.holdings
        ?.map((holding) => ({
          name: holding.name ?? holding.company ?? "Unknown",
          weight: toNumber(holding.weight ?? holding.percentage) ?? 0,
        }))
        .filter((holding) => holding.weight > 0)
        .slice(0, 10),
      sectorAllocation: data.sectors
        ?.map((sector) => ({
          name: sector.name ?? sector.sector ?? "Unknown",
          value: toNumber(sector.weight ?? sector.percentage) ?? 0,
        }))
        .filter((sector) => sector.value > 0)
        .slice(0, 10),
      marketCapAllocation: data.market_cap
        ? Object.entries(data.market_cap).map(([name, value]) => ({ name, value }))
        : undefined,
    };
  } catch {
    return null;
  }
}

function withFallbackTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

async function fetchYahooSummary(symbol: string) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        symbol,
      )}?modules=assetProfile,price`,
      { next: { revalidate: 60 * 60 * 6 } },
    );

    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as YahooQuoteSummaryResponse;
    const result = payload.quoteSummary?.result?.[0];

    return {
      sector: result?.assetProfile?.sector,
      marketCap: result?.price?.marketCap?.raw,
    };
  } catch {
    return {};
  }
}

function marketCapBucket(marketCap: number) {
  const marketCapCr = marketCap / 10_000_000;

  if (marketCapCr >= 20_000) {
    return "Large Cap";
  }

  if (marketCapCr >= 5_000) {
    return "Mid Cap";
  }

  return "Small Cap";
}
