import { addExcludeDateToTask } from '../utils/scheduleUtils';
import type { Task } from '../types/task';

describe('scheduleUtils', () => {
  it('adds excludeDates to existing schedules', () => {
    const task: Task = {
      id: 'task1',
      title: 'Recurring',
      createdAt: new Date().toISOString(),
      enabled: true,
      type: 'recurring',
      schedule: {
        rule: { frequency: 'daily', interval: 1 },
        dueTime: '09:00',
      },
    };

    const updated = addExcludeDateToTask(task, '2026-02-01');
    expect(updated.schedule?.excludeDates).toContain('2026-02-01');
  });
});
