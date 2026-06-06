import type { AssetType, SipFrequency, TransactionType } from "@/types/portfolio";

export const MUTUAL_FUND_STAMP_DUTY_RATE = 0.00005;

type CurrencyFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatCurrency(value: number, options: CurrencyFormatOptions = {}) {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
  } = options;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

export function formatCurrencyWithDecimals(value: number, digits = 2) {
  return formatCurrency(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatNav(value: number) {
  return formatCurrency(value, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function monthlyEquivalent(amount: number, frequency: SipFrequency) {
  if (frequency === "WEEKLY") {
    return amount * 4.33;
  }

  if (frequency === "QUARTERLY") {
    return amount / 3;
  }

  return amount;
}

export function isStampDutyApplicable(assetType?: AssetType | null, type?: TransactionType | null) {
  return (
    assetType === "MUTUAL_FUND" &&
    (type === "BUY" || type === "LUMPSUM" || type === "SIP_INSTALLMENT")
  );
}

export function calculateStampDuty(
  amount: number,
  assetType?: AssetType | null,
  type?: TransactionType | null,
) {
  if (!isStampDutyApplicable(assetType, type)) {
    return 0;
  }

  return Math.round(amount * MUTUAL_FUND_STAMP_DUTY_RATE * 100) / 100;
}

export function calculateNetInvestmentAmount(amount: number, stampDuty: number) {
  return Math.max(Number((amount - stampDuty).toFixed(2)), 0);
}

export function calculateUnits(amount: number, price: number, stampDuty = 0, precision = 3) {
  if (!price) {
    return 0;
  }

  return Number((calculateNetInvestmentAmount(amount, stampDuty) / price).toFixed(precision));
}
