import { computeDueAt } from '../utils/taskInstanceGeneration';
import type { Task } from '../types/task';

describe('taskInstanceGeneration', () => {
  it('keeps one-off due dates as local date-time strings', () => {
    const task: Task = {
      id: 'oneoff_local',
      title: 'One-off',
      createdAt: new Date().toISOString(),
      type: 'oneoff',
      enabled: true,
      oneOff: {
        dueDate: '2026-01-30T17:00',
      },
    };

    const dueAt = computeDueAt(task, '2026-01-30');
    expect(dueAt).toBe('2026-01-30T17:00');
  });
});
