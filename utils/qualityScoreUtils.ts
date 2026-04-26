/** Clamp parent-entered quality percentage to 0–100. */
export function clampQualityPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 100;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function applyQualityMultiplier(
  baseStars: number,
  baseMoney: number,
  qualityPercent: number,
): { stars: number; money: number } {
  const p = clampQualityPercent(qualityPercent) / 100;
  return {
    stars: Math.round(Number(baseStars) * p),
    money: Math.round(Number(baseMoney) * p * 100) / 100,
  };
}
