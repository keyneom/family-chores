import { choresAppReducer } from '../../components/ChoresAppContext';
import { buildTaskKey } from '../../utils/taskKey';
import { makeBaseState, makeTimedTask } from './helpers';

describe('Smoke: timed outcomes matrix', () => {
  it('on-time stop produces full reward and pending approval by default', () => {
    const task = makeTimedTask({ id: 'timed_a', stars: 4, money: 8 });
    const taskKey = buildTaskKey(1, task.id, '2026-04-21');
    const base = makeBaseState({
      tasks: [task],
      timers: {
        timer_on_time: {
          id: 'timer_on_time',
          taskKey,
          childId: 1,
          startedAt: '2026-04-21T10:00:00.000Z',
          allowedSeconds: 300,
        },
      },
    });

    const state = choresAppReducer(base, {
      type: 'STOP_TIMER',
      payload: { timerId: 'timer_on_time', stoppedAt: '2026-04-21T10:04:00.000Z' },
    });

    expect(state.timedCompletions).toHaveLength(1);
    expect(state.timedCompletions?.[0].rewardPercentage).toBe(1);
    expect(state.timedCompletions?.[0].starReward).toBe(4);
    expect(state.timedCompletions?.[0].moneyReward).toBe(8);
    expect(state.timedCompletions?.[0].approved).toBe(false);
  });

  it('late stop applies penalty and then approve/forgive branches diverge on money', () => {
    const task = makeTimedTask({
      id: 'timed_b',
      stars: 2,
      money: 10,
      timed: {
        allowedSeconds: 300,
        latePenaltyPercent: 0.5,
        autoApproveOnStop: false,
        allowNegative: false,
      },
    });
    const taskKey = buildTaskKey(1, task.id, '2026-04-21');
    const base = makeBaseState({
      tasks: [task],
      timers: {
        timer_late: {
          id: 'timer_late',
          taskKey,
          childId: 1,
          startedAt: '2026-04-21T10:00:00.000Z',
          allowedSeconds: 300,
        },
      },
    });

    const stopped = choresAppReducer(base, {
      type: 'STOP_TIMER',
      payload: { timerId: 'timer_late', stoppedAt: '2026-04-21T10:08:00.000Z' },
    });
    const completionId = stopped.timedCompletions?.[0].id as string;

    // Approve with money.
    const approved = choresAppReducer(stopped, {
      type: 'APPROVE_TIMED_COMPLETION',
      payload: { completionId, approve: true, applyMoney: true },
    });
    expect(approved.children.find((child) => child.id === 1)?.stars).toBe(0); // late => zero stars in STOP_TIMER
    expect(approved.children.find((child) => child.id === 1)?.money).toBe(5); // 50% of 10

    // Approve but forgive money.
    const forgiven = choresAppReducer(stopped, {
      type: 'APPROVE_TIMED_COMPLETION',
      payload: { completionId, approve: true, applyMoney: false },
    });
    expect(forgiven.children.find((child) => child.id === 1)?.stars).toBe(0);
    expect(forgiven.children.find((child) => child.id === 1)?.money).toBe(0);
  });

  it('auto-approve on stop immediately applies rewards', () => {
    const task = makeTimedTask({
      id: 'timed_c',
      stars: 3,
      money: 6,
      timed: {
        allowedSeconds: 300,
        latePenaltyPercent: 0.5,
        autoApproveOnStop: true,
        allowNegative: false,
      },
    });
    const taskKey = buildTaskKey(1, task.id, '2026-04-21');
    const base = makeBaseState({
      tasks: [task],
      timers: {
        timer_auto: {
          id: 'timer_auto',
          taskKey,
          childId: 1,
          startedAt: '2026-04-21T10:00:00.000Z',
          allowedSeconds: 300,
        },
      },
    });

    const state = choresAppReducer(base, {
      type: 'STOP_TIMER',
      payload: { timerId: 'timer_auto', stoppedAt: '2026-04-21T10:03:00.000Z' },
    });

    expect(state.timedCompletions?.[0].approved).toBe(true);
    expect(state.children.find((child) => child.id === 1)?.stars).toBe(3);
    expect(state.children.find((child) => child.id === 1)?.money).toBe(6);
  });
});
