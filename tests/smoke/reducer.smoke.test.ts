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
    expect(state.children.find((child) => child.id === 1)?.stars).toBe(2);
    expect(state.children.find((child) => child.id === 1)?.money).toBe(1.25);
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
