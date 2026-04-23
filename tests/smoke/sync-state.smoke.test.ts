import { choresAppReducer } from '../../components/ChoresAppContext';
import type { Task } from '../../types/task';
import { makeBaseState } from './helpers';

describe('Smoke: sync state import behavior', () => {
  it('normalizes imported tasks and instances via SET_STATE happy path', () => {
    const importedTask: Task = {
      id: 'task_imported',
      title: 'Imported task',
      createdAt: '2026-04-21T10:00:00.000Z',
      type: 'recurring',
      enabled: true,
      stars: 1,
      money: 0.25,
      assignedChildIds: [1, 2],
      recurring: { cadence: 'daily', timeOfDay: '17:00' },
    };

    const state = choresAppReducer(makeBaseState(), {
      type: 'SET_STATE',
      payload: {
        ...makeBaseState(),
        tasks: [importedTask],
        taskInstances: [
          {
            id: 'inst_imported',
            templateId: 'task_imported',
            childId: 1,
            date: '2026-04-21',
            dueAt: '2026-04-21T17:00:00.000Z',
            completed: false,
            createdAt: '2026-04-21T10:00:00.000Z',
          },
        ],
      },
    });

    expect(state.tasks[0].assignment?.childIds).toEqual([1, 2]);
    expect(state.tasks[0].rotation?.mode).toBe('round-robin');
    expect(state.taskInstances[0].dueAt).toMatch(/^2026-04-21T\d{2}:\d{2}$/);
  });

  it('keeps state shape stable for minimal imported data', () => {
    const base = makeBaseState();
    const state = choresAppReducer(base, {
      type: 'SET_STATE',
      payload: {
        ...base,
        children: [],
        tasks: [],
        taskInstances: [],
      },
    });

    expect(state.children).toEqual([]);
    expect(state.tasks).toEqual([]);
    expect(state.taskInstances).toEqual([]);
    expect(state.parentSettings.approvals).toBeDefined();
  });
});
