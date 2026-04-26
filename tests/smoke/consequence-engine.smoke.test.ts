import { choresAppReducer } from '../../components/ChoresAppContext';
import type { Task, TaskInstance } from '../../types/task';
import {
  applyUndonePenaltyIfDue,
  evaluateConsequenceRules,
  resolveContinuousMoneyOutcome,
  resolveMoneyTier,
  resolveTimedOutcome,
} from '../../utils/consequenceEngine';
import { makeBaseState, makeRecurringTask, makeTaskInstance, makeTimedTask } from './helpers';

describe('Smoke: consequence engine', () => {
  it('resolves tiered windows deterministically', () => {
    const tiers = [
      { id: 'a', fromMinutesLate: 0, toMinutesLate: 15, moneyDeltaType: 'absolute' as const, value: 1 },
      { id: 'b', fromMinutesLate: 15, toMinutesLate: 30, moneyDeltaType: 'absolute' as const, value: 0 },
      { id: 'c', fromMinutesLate: 30, moneyDeltaType: 'absolute' as const, value: -1 },
    ];
    expect(resolveMoneyTier(tiers, 10)?.id).toBe('a');
    expect(resolveMoneyTier(tiers, 15)?.id).toBe('b');
    expect(resolveMoneyTier(tiers, 30)?.id).toBe('c');
  });

  it('supports continuous decay with clamp', () => {
    expect(
      resolveContinuousMoneyOutcome(2, 30, { ratePerMinuteLate: 0.01, minPayout: -2 }),
    ).toBeCloseTo(1.7);
    expect(
      resolveContinuousMoneyOutcome(2, 600, { ratePerMinuteLate: 0.01, minPayout: -2 }),
    ).toBe(-2);
  });

  it('maps timed outcomes through unified evaluator', () => {
    const task: Task = makeTimedTask({
      money: 2,
      stars: 1,
      timed: { allowedSeconds: 60, latePenaltyPercent: 0.5, autoApproveOnStop: false, allowNegative: true },
    });
    const onTime = resolveTimedOutcome(task, 45, 60);
    const late = resolveTimedOutcome(task, 90, 60);
    expect(onTime.moneyReward).toBe(2);
    expect(late.moneyReward).toBe(1);
    expect(late.starReward).toBe(0);
  });

  it('applies undone penalty once', () => {
    const task: Task = makeRecurringTask({
      id: 'penalty_task',
      money: 2,
      moneyPolicy: {
        mode: 'tiered',
        undonePenalty: { enabled: true, cutoffMode: 'end_of_day', moneyDeltaType: 'absolute', value: -2 },
      },
    });
    const instance: TaskInstance = makeTaskInstance({
      templateId: 'penalty_task',
      date: '2026-04-24',
      completed: false,
    });
    const applied = applyUndonePenaltyIfDue(task, instance, '2026-04-26T12:00:00.000Z');
    expect(applied?.moneyReward).toBe(-2);
    const alreadyApplied = applyUndonePenaltyIfDue(task, { ...instance, undonePenaltyAppliedAt: '2026-04-25T00:01:00.000Z' }, '2026-04-25T02:00:00.000Z');
    expect(alreadyApplied).toBeNull();
  });

  it('does not auto-apply next_due undone penalty without schedule context', () => {
    const task: Task = makeRecurringTask({
      money: 2,
      moneyPolicy: {
        mode: 'simple',
        undonePenalty: { enabled: true, cutoffMode: 'next_due', moneyDeltaType: 'absolute', value: -1 },
      },
    });
    const instance: TaskInstance = makeTaskInstance({ date: '2026-04-20', completed: false });
    const result = applyUndonePenaltyIfDue(task, instance, '2026-04-25T12:00:00.000Z');
    expect(result).toBeNull();
  });

  it('supports mark unfinished and undone penalty reducer actions', () => {
    const task = makeRecurringTask({
      id: 'task_reducer_policy',
      money: 2,
      stars: 1,
      moneyPolicy: {
        mode: 'tiered',
        undonePenalty: { enabled: true, cutoffMode: 'end_of_day', moneyDeltaType: 'absolute', value: -2 },
      },
    });
    const instance = makeTaskInstance({
      id: 'inst_reducer',
      templateId: 'task_reducer_policy',
      date: '2026-04-24',
      completed: true,
    });
    let state = makeBaseState({ tasks: [task], taskInstances: [instance] });
    state = choresAppReducer(state, {
      type: 'MARK_TASK_UNFINISHED',
      payload: { instanceId: 'inst_reducer', childId: 1, starDelta: -1, moneyDelta: -2 },
    });
    expect(state.taskInstances.find(i => i.id === 'inst_reducer')?.completed).toBe(false);
    expect(state.children.find(c => c.id === 1)?.stars).toBe(-1);

    state = choresAppReducer(state, {
      type: 'APPLY_UNDONE_PENALTY',
      payload: { nowIso: '2026-04-26T12:00:00.000Z' },
    });
    expect(state.children.find(c => c.id === 1)?.money).toBe(-4);
  });

  it('supports consequence rule overrides', () => {
    const task: Task = makeRecurringTask({
      consequenceRules: [
        { id: 'late_override', trigger: 'late', moneyDeltaType: 'absolute', moneyValue: -1, starDelta: 0 },
      ],
      stars: 2,
      money: 2,
    });
    const out = evaluateConsequenceRules(task, {
      trigger: 'late',
      baseStars: 2,
      baseMoney: 2,
      minutesLate: 42,
    });
    expect(out.moneyReward).toBe(-1);
    expect(out.starReward).toBe(0);
  });
});

