export type AllocationPoint = {
  name: string;
  value: number;
};

export function parseStoredAllocation(value: unknown): AllocationPoint[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const points = value
    .map((point) => {
      if (!point || typeof point !== "object") {
        return null;
      }

      const candidate = point as { name?: unknown; value?: unknown };
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const amount = Number(candidate.value);

      return name && Number.isFinite(amount) && amount > 0 ? { name, value: amount } : null;
    })
    .filter((point): point is AllocationPoint => point !== null);

  return points.length ? points : undefined;
}

export function inferSectorAllocation(name: string, category?: string | null) {
  const text = `${name} ${category ?? ""}`.toLowerCase();
  const sectors: Array<[RegExp, string]> = [
    [/technology|digital|it\b|software|internet|ai|artificial intelligence|nasdaq/, "Technology"],
    [/bank|financial|finance|psu bank|private bank|banking/, "Financial"],
    [/pharma|healthcare|health care|hospital/, "Healthcare"],
    [/infra|infrastructure|power|energy|oil|gas/, "Energy & Infrastructure"],
    [/consumer|consumption|fmcg/, "Consumer"],
    [/auto|automobile|transport/, "Automobile"],
  ];
  const match = sectors.find(([pattern]) => pattern.test(text));

  return match ? [{ name: match[1], value: 100 }] : undefined;
}

export function inferMarketCapAllocation(name: string, category?: string | null) {
  const text = `${name} ${category ?? ""}`.toLowerCase();

  if (/large\s*&\s*mid|large and mid/.test(text)) {
    return [
      { name: "Large Cap", value: 50 },
      { name: "Mid Cap", value: 50 },
    ];
  }

  if (
    /large cap|bluechip|blue chip|\bnifty\s*50\b|\bsensex\b|\bnifty\s*next\s*50\b|\bnasdaq\s*100\b|\bs&p\s*500\b/.test(
      text,
    )
  ) {
    return [{ name: "Large Cap", value: 100 }];
  }

  if (/mid cap|midcap/.test(text)) {
    return [{ name: "Mid Cap", value: 100 }];
  }

  if (/small cap|smallcap|micro cap|microcap/.test(text)) {
    return [{ name: "Small Cap", value: 100 }];
  }

  if (/flexi cap|flexicap|multi cap|multicap|focused/.test(text)) {
    return [
      { name: "Large Cap", value: 50 },
      { name: "Mid Cap", value: 30 },
      { name: "Small Cap", value: 20 },
    ];
  }

  return undefined;
}
