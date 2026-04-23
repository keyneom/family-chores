import { hasApprovers, requiresPin } from '../../utils/approvalUtils';
import { makeBaseState, makeRecurringTask } from './helpers';

describe('Smoke: approval gating decisions', () => {
  it('requires pin for completion when task-level pin is enabled', () => {
    const parentSettings = makeBaseState().parentSettings;
    const task = makeRecurringTask({ requirePin: true });
    expect(requiresPin({ action: 'complete', parentSettings, task })).toBe(true);
  });

  it('requires pin for configured parent approval toggles', () => {
    const base = makeBaseState().parentSettings;
    const withApprovals = {
      ...base,
      approvals: {
        ...base.approvals,
        taskMove: true,
        earlyComplete: true,
        taskComplete: true,
        editTasks: true,
      },
    };

    expect(requiresPin({ action: 'taskMove', parentSettings: withApprovals })).toBe(true);
    expect(requiresPin({ action: 'earlyComplete', parentSettings: withApprovals })).toBe(true);
    expect(requiresPin({ action: 'complete', parentSettings: withApprovals })).toBe(true);
    expect(requiresPin({ action: 'editTasks', parentSettings: withApprovals })).toBe(true);
    expect(requiresPin({ action: 'deleteTasks', parentSettings: withApprovals })).toBe(true);
  });

  it('handles no-approver guard branch', () => {
    const parentSettings = makeBaseState().parentSettings;
    expect(hasApprovers(parentSettings)).toBe(false);
    expect(
      hasApprovers({
        ...parentSettings,
        pins: [{ handle: 'Mom', pinHash: 'hash', salt: 'salt' }],
      }),
    ).toBe(true);
  });
});
