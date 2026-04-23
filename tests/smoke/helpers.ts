import type { ChoresAppState, Child } from '../../components/ChoresAppContext';
import type { Task, TaskInstance } from '../../types/task';

export function makeChildren(): Child[] {
  return [
    { id: 1, name: 'Ava', stars: 0, money: 0 },
    { id: 2, name: 'Ben', stars: 0, money: 0 },
  ];
}

export function makeBaseState(overrides: Partial<ChoresAppState> = {}): ChoresAppState {
  return {
    children: makeChildren(),
    tasks: [],
    taskInstances: [],
    parentSettings: {
      approvals: {
        taskMove: false,
        earlyComplete: false,
        taskComplete: false,
        editTasks: false,
      },
      timedAutoApproveDefault: false,
      pins: [],
      childDisplayOrder: [1, 2],
      onboardingCompleted: false,
    },
    completedTasks: {},
    timers: {},
    timedCompletions: [],
    actionLog: [],
    ...overrides,
  };
}

export function makeRecurringTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_recurring',
    title: 'Take out trash',
    createdAt: '2026-04-20T10:00:00.000Z',
    type: 'recurring',
    enabled: true,
    stars: 1,
    money: 0.5,
    recurring: { cadence: 'daily', timeOfDay: '17:00' },
    ...overrides,
  };
}

export function makeTimedTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_timed',
    title: 'Homework sprint',
    createdAt: '2026-04-20T10:00:00.000Z',
    type: 'recurring',
    enabled: true,
    stars: 3,
    money: 2,
    timed: {
      allowedSeconds: 300,
      latePenaltyPercent: 0.5,
      autoApproveOnStop: false,
      allowNegative: false,
    },
    recurring: { cadence: 'daily', timeOfDay: '17:00' },
    ...overrides,
  };
}

export function makeOneOffTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_oneoff',
    title: 'Science fair poster',
    createdAt: '2026-04-20T10:00:00.000Z',
    type: 'oneoff',
    enabled: true,
    stars: 2,
    money: 1,
    oneOff: { dueDate: '2026-04-21T17:00' },
    ...overrides,
  };
}

export function makeTaskInstance(overrides: Partial<TaskInstance> = {}): TaskInstance {
  return {
    id: 'inst_1',
    templateId: 'task_recurring',
    childId: 1,
    date: '2026-04-21',
    completed: false,
    createdAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  };
}
