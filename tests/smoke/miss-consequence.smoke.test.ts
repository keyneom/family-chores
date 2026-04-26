import {
  buildMissConsequencePayload,
  missConsequenceToFormState,
  taskHasMissConsequenceConfigured,
} from '../../utils/missConsequenceUtils';

describe('Smoke: miss consequence helpers', () => {
  it('round-trips legacy money-only and combined money+stars', () => {
    const legacyMoney = buildMissConsequencePayload(2.5, 0, false, '');
    expect(legacyMoney.type).toBe('money_penalty');
    expect(missConsequenceToFormState(legacyMoney)).toMatchObject({
      moneyPenalty: 2.5,
      starPenalty: 0,
      forfeitBaseReward: false,
      customLabel: '',
    });

    const combined = buildMissConsequencePayload(1, 2, true, 'Extra duty');
    expect(combined.type).toBe('combined');
    expect(combined.moneyAmount).toBe(1);
    expect(combined.starAmount).toBe(2);
    expect(combined.zeroBaseReward).toBe(true);
    expect(combined.customLabel).toBe('Extra duty');
    expect(missConsequenceToFormState(combined)).toMatchObject({
      moneyPenalty: 1,
      starPenalty: 2,
      forfeitBaseReward: true,
      customLabel: 'Extra duty',
    });
  });

  it('detects configured vs none', () => {
    expect(taskHasMissConsequenceConfigured({ type: 'none' })).toBe(false);
    expect(taskHasMissConsequenceConfigured(undefined)).toBe(false);
    expect(taskHasMissConsequenceConfigured({ type: 'star_penalty', starAmount: 1 })).toBe(true);
    expect(taskHasMissConsequenceConfigured({ type: 'combined', zeroBaseReward: true })).toBe(true);
  });
});
