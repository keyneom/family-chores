import type { MissConsequenceConfig, MissConsequenceType } from '../types/task';

export type MissConsequenceFormState = {
  moneyPenalty: number;
  starPenalty: number;
  forfeitBaseReward: boolean;
  customLabel: string;
};

/** Map stored task config into independent form fields (supports legacy single-select types). */
export function missConsequenceToFormState(miss?: MissConsequenceConfig): MissConsequenceFormState {
  if (!miss || miss.type === 'none') {
    return { moneyPenalty: 0, starPenalty: 0, forfeitBaseReward: false, customLabel: '' };
  }
  if (miss.type === 'money_penalty') {
    return {
      moneyPenalty: Number(miss.moneyAmount ?? 0),
      starPenalty: 0,
      forfeitBaseReward: false,
      customLabel: '',
    };
  }
  if (miss.type === 'star_penalty') {
    return {
      moneyPenalty: 0,
      starPenalty: Number(miss.starAmount ?? 0),
      forfeitBaseReward: false,
      customLabel: '',
    };
  }
  if (miss.type === 'reward_zero') {
    return { moneyPenalty: 0, starPenalty: 0, forfeitBaseReward: true, customLabel: '' };
  }
  if (miss.type === 'custom_consequence') {
    return {
      moneyPenalty: 0,
      starPenalty: 0,
      forfeitBaseReward: false,
      customLabel: (miss.customLabel || '').trim(),
    };
  }
  // `combined` or forward-compatible unknown shapes with extra fields
  return {
    moneyPenalty: Number(miss.moneyAmount ?? 0),
    starPenalty: Number(miss.starAmount ?? 0),
    forfeitBaseReward: Boolean(miss.zeroBaseReward),
    customLabel: (miss.customLabel || '').trim(),
  };
}

function singleLegacyType(
  money: number,
  stars: number,
  forfeit: boolean,
  custom: string,
): MissConsequenceType | null {
  const hasMoney = money > 0;
  const hasStars = stars > 0;
  const hasCustom = custom.length > 0;
  const levers = [hasMoney, hasStars, forfeit, hasCustom].filter(Boolean).length;
  if (levers !== 1) return null;
  if (hasMoney) return 'money_penalty';
  if (hasStars) return 'star_penalty';
  if (forfeit) return 'reward_zero';
  if (hasCustom) return 'custom_consequence';
  return null;
}

/**
 * Persist miss configuration. Uses a compact legacy `type` when exactly one option is set;
 * otherwise stores `combined` with all applicable fields.
 */
export function buildMissConsequencePayload(
  moneyPenalty: number,
  starPenalty: number,
  forfeitBaseReward: boolean,
  customLabel: string,
): MissConsequenceConfig {
  const money = Math.max(0, Number(moneyPenalty) || 0);
  const stars = Math.max(0, Number(starPenalty) || 0);
  const label = customLabel.trim();
  const forfeit = Boolean(forfeitBaseReward);

  if (money <= 0 && stars <= 0 && !forfeit && !label) {
    return { type: 'none' };
  }

  const legacy = singleLegacyType(money, stars, forfeit, label);
  if (legacy === 'money_penalty') {
    return { type: 'money_penalty', moneyAmount: money };
  }
  if (legacy === 'star_penalty') {
    return { type: 'star_penalty', starAmount: stars };
  }
  if (legacy === 'reward_zero') {
    return { type: 'reward_zero', zeroBaseReward: true };
  }
  if (legacy === 'custom_consequence') {
    return { type: 'custom_consequence', customLabel: label };
  }

  return {
    type: 'combined',
    ...(money > 0 ? { moneyAmount: money } : {}),
    ...(stars > 0 ? { starAmount: stars } : {}),
    ...(forfeit ? { zeroBaseReward: true } : {}),
    ...(label ? { customLabel: label } : {}),
  };
}

/** True when anything other than “no miss policy” is configured. */
export function taskHasMissConsequenceConfigured(miss?: MissConsequenceConfig): boolean {
  if (!miss || miss.type === 'none') return false;
  const f = missConsequenceToFormState(miss);
  return f.moneyPenalty > 0 || f.starPenalty > 0 || f.forfeitBaseReward || f.customLabel.length > 0;
}
