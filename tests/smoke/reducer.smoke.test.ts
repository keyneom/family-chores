import { choresAppReducer } from '../../components/ChoresAppContext';
import { buildTaskKey } from '../../utils/taskKey';
import {
  makeBaseState,
  makeOneOffTask,
  makeRecurringTask,
  makeTaskInstance,
  makeTimedTask,
} from './helpers';

describe('Smoke: reducer core workflows', () => {
  it('handles child and task lifecycle happy path', () => {
    let state = makeBaseState();
    state = choresAppReducer(state, {
      type: 'ADD_CHILD',
      payload: { id: 3, name: 'Noah', stars: 0, money: 0 },
    });
    expect(state.children).toHaveLength(3);

    const recurring = makeRecurringTask({ assignedChildIds: [1, 2] });
    state = choresAppReducer(state, { type: 'ADD_TASK', payload: recurring });
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].assignment?.strategy).toBe('round_robin');

    const updated = { ...state.tasks[0], title: 'Take out trash (updated)' };
    state = choresAppReducer(state, { type: 'UPDATE_TASK', payload: updated });
    expect(state.tasks[0].title).toContain('updated');

    state = choresAppReducer(state, { type: 'DELETE_TASK', payload: recurring.id });
    expect(state.tasks).toHaveLength(0);
  });

  it('covers instance completion and duplicate-add guard', () => {
    let state = makeBaseState({
      tasks: [makeRecurringTask()],
      taskInstances: [makeTaskInstance()],
    });

    // Duplicate add should no-op.
    state = choresAppReducer(state, { type: 'ADD_TASK_INSTANCE', payload: makeTaskInstance() });
    expect(state.taskInstances).toHaveLength(1);

    state = choresAppReducer(state, {
      type: 'COMPLETE_TASK_INSTANCE',
      payload: { instanceId: 'inst_1', childId: 1, starReward: 2, moneyReward: 1.25 },
    });

    const completed = state.taskInstances.find((inst) => inst.id === 'inst_1');
    expect(completed?.completed).toBe(true);
    expect(completed?.rewardStarsApplied).toBe(2);
    expect(completed?.rewardMoneyApplied).toBe(1.25);
    expect(state.children.find((child) => child.id === 1)?.stars).toBe(2);
    expect(state.children.find((child) => child.id === 1)?.money).toBe(1.25);
  });

  it('scales instance completion by quality percent and supports adjust', () => {
    let state = makeBaseState({
      tasks: [makeRecurringTask({ stars: 10, money: 4 })],
      taskInstances: [makeTaskInstance()],
    });
    state = choresAppReducer(state, {
      type: 'COMPLETE_TASK_INSTANCE',
      payload: { instanceId: 'inst_1', childId: 1, starReward: 10, moneyReward: 4, qualityScorePercent: 50 },
    });
    expect(state.children.find((c) => c.id === 1)?.stars).toBe(5);
    expect(state.children.find((c) => c.id === 1)?.money).toBe(2);
    const inst = state.taskInstances.find((i) => i.id === 'inst_1');
    expect(inst?.rewardStarsApplied).toBe(5);
    expect(inst?.completionQualityPercent).toBe(50);

    state = choresAppReducer(state, {
      type: 'ADJUST_INSTANCE_COMPLETION_QUALITY',
      payload: { instanceId: 'inst_1', childId: 1, qualityScorePercent: 100 },
    });
    expect(state.children.find((c) => c.id === 1)?.stars).toBe(10);
    expect(state.children.find((c) => c.id === 1)?.money).toBe(4);
    expect(state.taskInstances.find((i) => i.id === 'inst_1')?.completionQualityPercent).toBe(100);
  });

  it('handles timed stop happy path and missing-timer error path', () => {
    const timedTask = makeTimedTask();
    const taskKey = buildTaskKey(1, timedTask.id, '2026-04-21');
    const base = makeBaseState({
      tasks: [timedTask],
      timers: {
        timer_1: {
          id: 'timer_1',
          taskKey,
          childId: 1,
          startedAt: '2026-04-21T10:00:00.000Z',
          allowedSeconds: 300,
        },
      },
    });

    const stopped = choresAppReducer(base, {
      type: 'STOP_TIMER',
      payload: { timerId: 'timer_1', stoppedAt: '2026-04-21T10:04:00.000Z' },
    });
    expect(stopped.timers?.timer_1).toBeUndefined();
    expect(stopped.timedCompletions).toHaveLength(1);
    expect(stopped.timedCompletions?.[0].approved).toBe(false);

    // Missing timer should return state unchanged.
    const unchanged = choresAppReducer(base, {
      type: 'STOP_TIMER',
      payload: { timerId: 'does_not_exist', stoppedAt: '2026-04-21T10:04:00.000Z' },
    });
    expect(unchanged).toEqual(base);
  });

  it('applies combined missed consequence once when carry-over expires', () => {
    const task = makeRecurringTask({
      id: 'task_miss_policy',
      stars: 2,
      money: 3,
      carryOverPolicy: 'carry_none',
      missConsequence: {
        type: 'combined',
        starAmount: 1,
        moneyAmount: 0.5,
        zeroBaseReward: true,
        customLabel: 'Miss consequence',
      },
    });
    const instance = makeTaskInstance({
      id: 'inst_missed',
      templateId: 'task_miss_policy',
      date: '2026-04-20',
      completed: false,
      stars: 2,
      money: 3,
    });
    let state = makeBaseState({ tasks: [task], taskInstances: [instance] });
    state = choresAppReducer(state, {
      type: 'APPLY_MISSED_CONSEQUENCES',
      payload: { nowIso: '2026-04-25T10:00:00.000Z' },
    });
    expect(state.children.find((c) => c.id === 1)?.stars).toBe(-1);
    expect(state.children.find((c) => c.id === 1)?.money).toBe(-0.5);
    const updated = state.taskInstances.find((i) => i.id === 'inst_missed');
    expect(updated?.missConsequenceAppliedAt).toBeTruthy();
    expect(updated?.customConsequenceLabel).toBe('Miss consequence');

    const rerun = choresAppReducer(state, {
      type: 'APPLY_MISSED_CONSEQUENCES',
      payload: { nowIso: '2026-04-25T11:00:00.000Z' },
    });
    expect(rerun.children.find((c) => c.id === 1)?.stars).toBe(-1);
    expect(rerun.children.find((c) => c.id === 1)?.money).toBe(-0.5);
  });

  it('keeps forgiven timed money suppressed after score adjustment', () => {
    let state = makeBaseState({
      timedCompletions: [
        {
          id: 'tc_1',
          taskKey: buildTaskKey(1, 'task_timed', '2026-04-21'),
          childId: 1,
          startedAt: '2026-04-21T10:00:00.000Z',
          stoppedAt: '2026-04-21T10:05:00.000Z',
          allowedSeconds: 300,
          elapsedSeconds: 300,
          rewardPercentage: 1,
          starReward: 4,
          moneyReward: 2,
          approved: false,
          createdAt: '2026-04-21T10:05:01.000Z',
        },
      ],
      taskInstances: [
        makeTaskInstance({
          id: 'inst_timed',
          templateId: 'task_timed',
          date: '2026-04-21',
          completed: true,
          timedCompletionId: 'tc_1',
        }),
      ],
    });
    state = choresAppReducer(state, {
      type: 'APPROVE_TIMED_COMPLETION',
      payload: { completionId: 'tc_1', approve: true, applyMoney: false, qualityScorePercent: 50 },
    });
    expect(state.children.find((c) => c.id === 1)?.stars).toBe(2);
    expect(state.children.find((c) => c.id === 1)?.money).toBe(0);
    expect(state.taskInstances.find((i) => i.id === 'inst_timed')?.rewardMoneySuppressed).toBe(true);

    state = choresAppReducer(state, {
      type: 'ADJUST_INSTANCE_COMPLETION_QUALITY',
      payload: { instanceId: 'inst_timed', childId: 1, qualityScorePercent: 100 },
    });
    expect(state.children.find((c) => c.id === 1)?.stars).toBe(4);
    expect(state.children.find((c) => c.id === 1)?.money).toBe(0);
    expect(state.taskInstances.find((i) => i.id === 'inst_timed')?.rewardMoneyApplied).toBe(0);
  });

  it('resets started/completed task progress and clears timer/pending completion', () => {
    const taskKey = buildTaskKey(1, 'task_recurring', '2026-04-21');
    let state = makeBaseState({
      tasks: [makeRecurringTask({ id: 'task_recurring', stars: 3, money: 1.5 })],
      taskInstances: [
        makeTaskInstance({
          id: 'inst_reset',
          templateId: 'task_recurring',
          date: '2026-04-21',
          completed: true,
          rewardStarsApplied: 3,
          rewardMoneyApplied: 1.5,
          completionQualityPercent: 100,
        }),
      ],
      timers: {
        timer_reset: {
          id: 'timer_reset',
          taskKey,
          childId: 1,
          startedAt: '2026-04-21T10:00:00.000Z',
          allowedSeconds: 300,
        },
      },
      timedCompletions: [
        {
          id: 'tc_reset',
          taskKey,
          childId: 1,
          startedAt: '2026-04-21T10:00:00.000Z',
          stoppedAt: '2026-04-21T10:05:00.000Z',
          allowedSeconds: 300,
          elapsedSeconds: 300,
          rewardPercentage: 1,
          starReward: 3,
          moneyReward: 1.5,
          approved: true,
          createdAt: '2026-04-21T10:05:01.000Z',
        },
      ],
      completedTasks: {
        [taskKey]: true,
        '1-task_recurring-2026-04-21': true,
      },
      children: [{ id: 1, name: 'Ava', stars: 3, money: 1.5 }, { id: 2, name: 'Ben', stars: 0, money: 0 }],
    });

    state = choresAppReducer(state, {
      type: 'RESET_TASK_PROGRESS',
      payload: { taskKey, childId: 1, instanceId: 'inst_reset' },
    });

    expect(state.timers?.timer_reset).toBeUndefined();
    expect(state.timedCompletions?.find((tc) => tc.id === 'tc_reset')).toBeUndefined();
    const inst = state.taskInstances.find((i) => i.id === 'inst_reset');
    expect(inst?.completed).toBe(false);
    expect(inst?.completedAt).toBeUndefined();
    expect(inst?.completionQualityPercent).toBeUndefined();
    expect(state.children.find((c) => c.id === 1)?.stars).toBe(0);
    expect(state.children.find((c) => c.id === 1)?.money).toBe(0);
    expect(state.completedTasks[taskKey]).toBeUndefined();
  });

  it('handles one-off and future-disable semantics', () => {
    let state = makeBaseState({
      tasks: [makeOneOffTask(), makeRecurringTask()],
      taskInstances: [
        makeTaskInstance({ id: 'future_inst', date: '2026-04-23', templateId: 'task_recurring' }),
      ],
    });

    state = choresAppReducer(state, {
      type: 'DISABLE_TASK_AFTER_DATE',
      payload: { taskId: 'task_recurring', date: '2026-04-22' },
    });
    expect(state.tasks.find((task) => task.id === 'task_recurring')?.disabledAfter).toBe('2026-04-22');

    state = choresAppReducer(state, {
      type: 'DELETE_TASK',
      payload: 'task_oneoff',
    });
    expect(state.tasks.find((task) => task.id === 'task_oneoff')).toBeUndefined();
  });
});
