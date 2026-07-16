export const fmtMoney = (n: number): string =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export const fmtMoneyCompact = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
};

export const fmtPct = (n: number): string => `${n.toFixed(1)}%`;

export const monthToLabel = (m: number): string => {
  const yr = Math.floor((m - 1) / 12) + 1;
  const mo = ((m - 1) % 12) + 1;
  return `Yr ${yr} · Mo ${mo}`;
};
