import { applyQualityMultiplier, clampQualityPercent } from '../../utils/qualityScoreUtils';

describe('Smoke: quality score helpers', () => {
  it('clamps percent to 0–100', () => {
    expect(clampQualityPercent(150)).toBe(100);
    expect(clampQualityPercent(-5)).toBe(0);
    expect(clampQualityPercent(33.7)).toBe(34);
  });

  it('applies multiplier to stars and money', () => {
    expect(applyQualityMultiplier(10, 2.5, 40)).toEqual({ stars: 4, money: 1 });
    expect(applyQualityMultiplier(3, 1, 100)).toEqual({ stars: 3, money: 1 });
  });
});
