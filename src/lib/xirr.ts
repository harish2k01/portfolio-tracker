export type XirrCashFlow = {
  amount: number;
  date: string | Date;
};

const DAYS_PER_YEAR = 365;
const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;

export function calculateXirr(cashFlows: XirrCashFlow[]) {
  const flows = cashFlows
    .map((flow) => ({
      amount: Number(flow.amount),
      date: parseFlowDate(flow.date),
    }))
    .filter((flow): flow is { amount: number; date: Date } =>
      Number.isFinite(flow.amount) && Math.abs(flow.amount) > 0.000001 && flow.date !== null,
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (
    flows.length < 2 ||
    !flows.some((flow) => flow.amount < 0) ||
    !flows.some((flow) => flow.amount > 0)
  ) {
    return null;
  }

  const firstDate = flows[0].date.getTime();
  const datedFlows = flows.map((flow) => ({
    amount: flow.amount,
    years: (flow.date.getTime() - firstDate) / (DAYS_PER_YEAR * 24 * 60 * 60 * 1000),
  }));

  const low = -0.999999;
  let high = 1;
  let lowValue = xnpv(datedFlows, low);
  let highValue = xnpv(datedFlows, high);

  for (let attempt = 0; attempt < 60 && lowValue * highValue > 0; attempt += 1) {
    high *= 2;
    highValue = xnpv(datedFlows, high);
  }

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) {
    return null;
  }

  let left = low;
  let right = high;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const mid = (left + right) / 2;
    const value = xnpv(datedFlows, mid);

    if (!Number.isFinite(value)) {
      return null;
    }

    if (Math.abs(value) < TOLERANCE) {
      return mid;
    }

    if (lowValue * value < 0) {
      right = mid;
      highValue = value;
    } else {
      left = mid;
      lowValue = value;
    }
  }

  return Number.isFinite(highValue) ? (left + right) / 2 : null;
}

function xnpv(flows: Array<{ amount: number; years: number }>, rate: number) {
  const base = 1 + rate;

  if (base <= 0) {
    return Number.NaN;
  }

  return flows.reduce((sum, flow) => sum + flow.amount / base ** flow.years, 0);
}

function parseFlowDate(value: string | Date) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
