import type { AssetType, TransactionType } from "@/types/portfolio";

export function assetTypeLabel(type?: AssetType | string | null) {
  if (type === "MUTUAL_FUND") {
    return "Mutual Fund";
  }

  if (type === "STOCK") {
    return "Stock";
  }

  if (type === "ETF") {
    return "ETF";
  }

  return "Investment";
}

export function transactionTypeLabel(
  type: TransactionType | string,
  assetType?: AssetType | string | null,
) {
  if (type === "SIP_INSTALLMENT") {
    return "SIP";
  }

  if (type === "LUMPSUM") {
    return "Lumpsum";
  }

  if (type === "SELL") {
    return assetType === "MUTUAL_FUND" ? "Redeem" : "Sell";
  }

  if (type === "BUY") {
    return "Buy";
  }

  return type;
}
