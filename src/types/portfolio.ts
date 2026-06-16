export type AssetType = "MUTUAL_FUND" | "ETF" | "STOCK";
export type SipFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY";
export type SipStatus = "ACTIVE" | "PAUSED";
export type TransactionType = "BUY" | "SELL" | "SIP_INSTALLMENT" | "LUMPSUM";
export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL";

export type SerializedAsset = {
  id: string;
  name: string;
  type: AssetType;
  symbol: string | null;
  schemeCode: string | null;
  exchange: string | null;
  category: string | null;
  amc: string | null;
  identity?: string;
  sectorAllocation?: AllocationPoint[];
  marketCapAllocation?: AllocationPoint[];
};

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

export type AllocationPoint = {
  name: string;
  value: number;
  amount?: number;
};

export type FundHoldingPoint = {
  name: string;
  weight: number;
  sector?: string;
  instrument?: string;
};

export type HoldingRow = {
  assetId: string;
  name: string;
  type: AssetType;
  assetClass: "Equity" | "Debt" | "Commodities";
  symbol?: string | null;
  schemeCode?: string | null;
  category?: string | null;
  investedAmount: number;
  quantity: number;
  currentPrice: number | null;
  currentValue: number;
  gain: number;
  gainPercent: number;
  assetAllocation?: AllocationPoint[];
  sectorAllocation?: AllocationPoint[];
  marketCapAllocation?: AllocationPoint[];
  fundHoldings?: FundHoldingPoint[];
};

export type SipRow = {
  id: string;
  amount: number;
  frequency: SipFrequency;
  startDate: string;
  nextDueDate: string | null;
  status: SipStatus;
  asset: SerializedAsset;
};

export type TransactionRow = {
  id: string;
  type: TransactionType;
  amount: number;
  quantity: number;
  navOrPrice: number;
  stampDuty: number;
  tradeDate: string;
  asset: SerializedAsset;
  sipId?: string | null;
};

export type PortfolioTimelinePoint = {
  date: string;
  invested: number;
  current: number;
};

export type PortfolioDashboard = {
  summary: {
    totalValue: number;
    investedAmount: number;
    gains: number;
    gainsPercent: number;
    realizedGain: number;
    monthlySipTotal: number;
    activeSipCount: number;
    holdingsCount: number;
  };
  holdings: HoldingRow[];
  sips: SipRow[];
  timeline: PortfolioTimelinePoint[];
  allocations: {
    assets: AllocationPoint[];
    sectors: AllocationPoint[];
    marketCap: AllocationPoint[];
    stockConcentration: AllocationPoint[];
  };
};
