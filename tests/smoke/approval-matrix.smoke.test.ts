import { requiresPin } from '../../utils/approvalUtils';
import { makeBaseState, makeRecurringTask } from './helpers';

describe('Smoke: approval matrix coverage', () => {
  it('enforces all parent approval toggles by action', () => {
    const base = makeBaseState().parentSettings;
    const task = makeRecurringTask();

    const scenarios = [
      { action: 'taskMove' as const, key: 'taskMove' as const },
      { action: 'earlyComplete' as const, key: 'earlyComplete' as const },
      { action: 'complete' as const, key: 'taskComplete' as const },
      { action: 'editTasks' as const, key: 'editTasks' as const },
      { action: 'deleteTasks' as const, key: 'editTasks' as const },
    ];

    for (const scenario of scenarios) {
      const parentSettings = {
        ...base,
        approvals: {
          taskMove: false,
          earlyComplete: false,
          taskComplete: false,
          editTasks: false,
          [scenario.key]: true,
        },
      };
      expect(requiresPin({ action: scenario.action, parentSettings, task })).toBe(true);
    }
  });

  it('task-level requirePin overrides complete action even if parent toggle is off', () => {
    const parentSettings = makeBaseState().parentSettings;
    const task = makeRecurringTask({ requirePin: true });
    expect(requiresPin({ action: 'complete', parentSettings, task })).toBe(true);
  });
});
