import type { AssetType } from "@prisma/client";

export type LogoProvider = "logo_dev" | "brandfetch";

export type InvestmentLogoInput = {
  name: string;
  type?: AssetType | null;
  symbol?: string | null;
  isin?: string | null;
  amc?: string | null;
  logoUrl?: string | null;
  logoSource?: string | null;
};

export type InvestmentLogoResult = {
  logoUrl: string | null;
  logoSource: string | null;
};

export function resolveInvestmentLogo(input: InvestmentLogoInput): InvestmentLogoResult {
  if (input.logoUrl) {
    return {
      logoUrl: input.logoUrl,
      logoSource: input.logoSource ?? "cached",
    };
  }

  const provider = currentLogoProvider();

  if (provider === "logo_dev") {
    return logoDevLogo(input);
  }

  if (provider === "brandfetch") {
    return brandfetchLogo(input);
  }

  return { logoUrl: null, logoSource: null };
}

export function logoCachePatch(input: InvestmentLogoInput) {
  const logo = resolveInvestmentLogo({ ...input, logoUrl: null, logoSource: null });

  if (!logo.logoUrl) {
    return {};
  }

  return {
    logoUrl: logo.logoUrl,
    logoSource: logo.logoSource,
    logoUpdatedAt: new Date(),
  };
}

export function logoForHoldingName(name: string) {
  return resolveInvestmentLogo({ name, type: "STOCK" }).logoUrl;
}

function currentLogoProvider(): LogoProvider | null {
  const configured = process.env.LOGO_PROVIDER?.trim().toLowerCase();

  if ((configured === "logo_dev" || configured === "logodev") && process.env.LOGO_DEV_TOKEN?.trim()) {
    return "logo_dev";
  }

  if (configured === "brandfetch" && process.env.BRANDFETCH_CLIENT_ID?.trim()) {
    return "brandfetch";
  }

  if (process.env.LOGO_DEV_TOKEN?.trim()) {
    return "logo_dev";
  }

  if (process.env.BRANDFETCH_CLIENT_ID?.trim()) {
    return "brandfetch";
  }

  return null;
}

function logoDevLogo(input: InvestmentLogoInput): InvestmentLogoResult {
  const token = process.env.LOGO_DEV_TOKEN?.trim();

  if (!token) {
    return { logoUrl: null, logoSource: null };
  }

  const base = "https://img.logo.dev";
  const params = `token=${encodeURIComponent(token)}&size=64&format=png`;
  const identifier = logoDevIdentifier(input);

  if (!identifier) {
    return { logoUrl: null, logoSource: null };
  }

  return {
    logoUrl: `${base}/${identifier.path}/${identifier.value}?${params}`,
    logoSource: `logo_dev:${identifier.path}`,
  };
}

function logoDevIdentifier(input: InvestmentLogoInput) {
  const type = input.type ?? "STOCK";

  if (type === "MUTUAL_FUND") {
    const fundHouse = normalizeBrandName(input.amc) ?? inferFundHouse(input.name);

    return fundHouse ? { path: "name", value: encodeURIComponent(fundHouse) } : null;
  }

  const isin = normalizeIsin(input.isin);

  if (isin) {
    return { path: "isin", value: encodeURIComponent(isin) };
  }

  const ticker = normalizeTicker(input.symbol);

  if (ticker) {
    return { path: "ticker", value: encodeURIComponent(ticker) };
  }

  const name = normalizeBrandName(input.name);

  return name ? { path: "name", value: encodeURIComponent(name) } : null;
}

function brandfetchLogo(input: InvestmentLogoInput): InvestmentLogoResult {
  const clientId = process.env.BRANDFETCH_CLIENT_ID?.trim();

  if (!clientId) {
    return { logoUrl: null, logoSource: null };
  }

  const identifier = brandfetchIdentifier(input);

  if (!identifier) {
    return { logoUrl: null, logoSource: null };
  }

  return {
    logoUrl: `https://cdn.brandfetch.io/${identifier.path}/${identifier.value}/h/128/w/128/fallback/lettermark/icon?c=${encodeURIComponent(clientId)}`,
    logoSource: `brandfetch:${identifier.path}`,
  };
}

function brandfetchIdentifier(input: InvestmentLogoInput) {
  const isin = normalizeIsin(input.isin);

  if (isin) {
    return { path: "isin", value: encodeURIComponent(isin) };
  }

  const ticker = normalizeTicker(input.symbol);

  if (ticker) {
    return { path: "ticker", value: encodeURIComponent(ticker) };
  }

  return null;
}

function normalizeIsin(value?: string | null) {
  const isin = value?.trim().toUpperCase();

  return isin && /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin) ? isin : null;
}

function normalizeTicker(value?: string | null) {
  const ticker = value?.trim().toUpperCase();

  if (!ticker || /[^A-Z0-9.^-]/.test(ticker)) {
    return null;
  }

  return ticker;
}

function normalizeBrandName(value?: string | null) {
  const name = value
    ?.replace(/\s+/g, " ")
    .replace(/\b(ltd\.?|limited|inc\.?|corporation|corp\.?|company|co\.)$/i, "")
    .trim();

  return name && name.length >= 2 ? name : null;
}

function inferFundHouse(name: string) {
  const cleaned = name
    .replace(/\bmutual\s+fund\b/gi, " ")
    .replace(/\bfund\s+of\s+fund\b/gi, " ")
    .replace(/\bfund\b/gi, " ")
    .replace(/\b(direct|regular)\s*(plan)?\b/gi, " ")
    .replace(/\b(growth|idcw|dividend)\s*(option|plan)?\b/gi, " ")
    .replace(/\b(equity|debt|hybrid|index|smallcap|small\s+cap|midcap|mid\s+cap|large\s+cap|flexi\s+cap|liquid|gold|savings|technology|nifty|sensex|nasdaq|fof|etf)\b/gi, " ")
    .replace(/[-\u2013]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean).slice(0, 3).join(" ");

  return normalizeBrandName(words);
}
