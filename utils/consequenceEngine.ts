import type {
  ConsequenceRule,
  ConsequenceTrigger,
  ContinuousMoneyPolicy,
  MoneyDeltaType,
  MoneyTierRule,
  Task,
  TaskInstance,
  UndonePenaltyRule,
} from '@/types/task';
import { missConsequenceToFormState } from './missConsequenceUtils';

export interface ConsequenceContext {
  trigger: ConsequenceTrigger;
  baseStars: number;
  baseMoney: number;
  minutesLate?: number;
}

export interface ConsequenceOutcome {
  starReward: number;
  moneyReward: number;
  matchedRuleId?: string;
  customConsequenceLabel?: string;
  zeroBaseReward?: boolean;
}

function applyMoneyDelta(baseMoney: number, deltaType: MoneyDeltaType, value: number): number {
  if (deltaType === 'absolute') return value;
  if (deltaType === 'delta') return baseMoney + value;
  return baseMoney * value;
}

export function resolveMoneyTier(
  tiers: MoneyTierRule[] | undefined,
  minutesLate: number,
): MoneyTierRule | undefined {
  if (!tiers || tiers.length === 0) return undefined;
  const sorted = [...tiers].sort((a, b) => a.fromMinutesLate - b.fromMinutesLate);
  return sorted.find((tier) => {
    const withinStart = minutesLate >= tier.fromMinutesLate;
    const withinEnd = typeof tier.toMinutesLate !== 'number' || minutesLate < tier.toMinutesLate;
    return withinStart && withinEnd;
  });
}

export function resolveContinuousMoneyOutcome(
  baseMoney: number,
  minutesLate: number,
  config: ContinuousMoneyPolicy | undefined,
): number {
  if (!config || typeof config.ratePerMinuteLate !== 'number') {
    return baseMoney;
  }
  if (
    typeof config.cutoffMinutes === 'number' &&
    minutesLate > config.cutoffMinutes &&
    typeof config.postCutoffFixedPayout === 'number'
  ) {
    return config.postCutoffFixedPayout;
  }
  let payout = baseMoney - config.ratePerMinuteLate * minutesLate;
  if (typeof config.minPayout === 'number') payout = Math.max(config.minPayout, payout);
  if (typeof config.maxPayout === 'number') payout = Math.min(config.maxPayout, payout);
  return payout;
}

export function evaluateConsequenceRules(
  task: Task,
  context: ConsequenceContext,
): ConsequenceOutcome {
  const baseStars = Number(context.baseStars || 0);
  const baseMoney = Number(context.baseMoney || 0);
  const rules = (task.consequenceRules || []).filter((rule) => rule.trigger === context.trigger);
  if (rules.length > 0) {
    const first = rules[0];
    const multiplier = typeof first.rewardMultiplier === 'number' ? first.rewardMultiplier : 1;
    const starsFromRule = typeof first.starDelta === 'number' ? first.starDelta : baseStars * multiplier;
    let moneyFromRule = baseMoney * multiplier;
    if (typeof first.moneyValue === 'number' && first.moneyDeltaType) {
      moneyFromRule = applyMoneyDelta(baseMoney, first.moneyDeltaType, first.moneyValue);
    }
    return {
      starReward: Number(starsFromRule),
      moneyReward: Number(moneyFromRule),
      matchedRuleId: first.id,
      customConsequenceLabel: first.customConsequenceLabel,
    };
  }

  if (context.trigger === 'late') {
    const lateMode = task.lateRewardMode || 'scaled_penalty';
    if (task.moneyPolicy?.mode === 'tiered' && typeof context.minutesLate === 'number') {
      const matchedTier = resolveMoneyTier(task.moneyPolicy.tiers, context.minutesLate);
      if (matchedTier) {
        return {
          starReward: lateMode === 'none' ? 0 : baseStars,
          moneyReward: applyMoneyDelta(baseMoney, matchedTier.moneyDeltaType, matchedTier.value),
          matchedRuleId: matchedTier.id,
        };
      }
    }
    if (task.moneyPolicy?.mode === 'continuous' && typeof context.minutesLate === 'number') {
      return {
        starReward: lateMode === 'none' ? 0 : baseStars,
        moneyReward: resolveContinuousMoneyOutcome(baseMoney, context.minutesLate, task.moneyPolicy.continuous),
      };
    }

    if (lateMode === 'money_forfeit') {
      return { starReward: baseStars, moneyReward: 0 };
    }
    if (lateMode === 'none') {
      return { starReward: 0, moneyReward: 0 };
    }
    if (lateMode === 'scaled_penalty') {
      const penalty = task.timed?.latePenaltyPercent ?? 0.5;
      const scaled = baseMoney * (1 - penalty);
      return {
        starReward: 0,
        moneyReward: task.timed?.allowNegative ? scaled : Math.max(0, scaled),
      };
    }
  }

  return {
    starReward: baseStars,
    moneyReward: baseMoney,
  };
}

export function resolveTimedOutcome(task: Task, elapsedSeconds: number, allowedSeconds: number): ConsequenceOutcome {
  const baseStars = Number(task.stars || 0);
  const baseMoney = Number(task.money || 0);
  if (elapsedSeconds <= allowedSeconds) {
    return evaluateConsequenceRules(task, { trigger: 'on_time', baseStars, baseMoney, minutesLate: 0 });
  }
  const minutesLate = Math.max(0, Math.ceil((elapsedSeconds - allowedSeconds) / 60));
  return evaluateConsequenceRules(task, { trigger: 'late', baseStars, baseMoney, minutesLate });
}

export function applyUndonePenaltyIfDue(
  task: Task,
  instance: TaskInstance,
  nowIso: string,
): ConsequenceOutcome | null {
  if (instance.undonePenaltyAppliedAt) return null;
  const penalty: UndonePenaltyRule | undefined = task.moneyPolicy?.undonePenalty;
  if (!penalty?.enabled || !penalty.moneyDeltaType || typeof penalty.value !== 'number') return null;

  if (penalty.cutoffMode === 'deadline' && penalty.cutoffAt) {
    if (new Date(nowIso).getTime() < new Date(penalty.cutoffAt).getTime()) return null;
  }
  if (penalty.cutoffMode === 'end_of_day') {
    const endOfDay = new Date(`${instance.date}T23:59:59`);
    if (new Date(nowIso).getTime() < endOfDay.getTime()) return null;
  }
  if (penalty.cutoffMode === 'next_due') {
    // `next_due` must be resolved with schedule-aware context outside this helper.
    // Returning null here prevents accidental immediate penalties.
    return null;
  }
  const moneyReward = applyMoneyDelta(Number(task.money || 0), penalty.moneyDeltaType, penalty.value);
  return { starReward: 0, moneyReward };
}

export function resolveMissConsequenceOutcome(
  task: Task,
  baseStars: number,
  baseMoney: number,
): ConsequenceOutcome {
  const miss = missConsequenceToFormState(task.missConsequence);
  const stars = miss.forfeitBaseReward ? 0 : Number(baseStars || 0);
  const money = miss.forfeitBaseReward ? 0 : Number(baseMoney || 0);
  return {
    starReward: stars - Number(miss.starPenalty || 0),
    moneyReward: money - Number(miss.moneyPenalty || 0),
    customConsequenceLabel: miss.customLabel || undefined,
    zeroBaseReward: miss.forfeitBaseReward,
  };
}

export function legacyTimedToConsequenceRules(task: Task): ConsequenceRule[] | undefined {
  if (!task.timed) return task.consequenceRules;
  if (task.consequenceRules && task.consequenceRules.length > 0) return task.consequenceRules;

  const penalty = task.timed.latePenaltyPercent ?? 0.5;
  return [
    {
      id: `${task.id}_on_time_default`,
      trigger: 'on_time',
      rewardMultiplier: 1,
    },
    {
      id: `${task.id}_late_default`,
      trigger: 'late',
      rewardMultiplier: 1 - penalty,
      starDelta: 0,
    },
  ];
}
