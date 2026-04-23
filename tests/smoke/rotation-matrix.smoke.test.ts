import type { Task } from '../../types/task';
import { getTheoreticalAssignment } from '../../utils/projectionUtils';

function makeRotatingTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_a',
    title: 'Rotation A',
    createdAt: '2026-04-20T10:00:00.000Z',
    type: 'recurring',
    enabled: true,
    stars: 1,
    money: 0,
    recurring: { cadence: 'daily', timeOfDay: '17:00' },
    schedule: {
      rule: {
        frequency: 'daily',
        interval: 1,
        startDate: '2026-04-21',
        startTime: '17:00',
      },
      dueTime: '17:00',
    },
    rotation: {
      mode: 'round-robin',
      assignedChildIds: [1, 2, 3],
      rotationOrder: [2, 3, 1],
      startDate: '2026-04-21',
    },
    ...overrides,
  };
}

describe('Smoke: rotation matrix correctness', () => {
  it('matches exact day-to-child assignments for 7-day explicit order', () => {
    const taskA = makeRotatingTask();
    const tasks = [taskA];
    const dates = [
      '2026-04-21',
      '2026-04-22',
      '2026-04-23',
      '2026-04-24',
      '2026-04-25',
      '2026-04-26',
      '2026-04-27',
    ];

    const expectedChildByDate: Record<string, number> = {
      '2026-04-21': 2,
      '2026-04-22': 3,
      '2026-04-23': 1,
      '2026-04-24': 2,
      '2026-04-25': 3,
      '2026-04-26': 1,
      '2026-04-27': 2,
    };

    for (const date of dates) {
      const assignments = getTheoreticalAssignment(taskA, date, tasks);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].childId).toBe(expectedChildByDate[date]);
    }
  });

  it('updates matrix after reorder and preserves linked-offset correctness', () => {
    const taskA = makeRotatingTask({
      id: 'task_a',
      title: 'Rotation A',
      rotation: {
        mode: 'round-robin',
        assignedChildIds: [1, 2, 3],
        rotationOrder: [1, 3, 2],
        startDate: '2026-04-21',
      },
    });

    const taskB = makeRotatingTask({
      id: 'task_b',
      title: 'Rotation B linked +1',
      rotation: {
        mode: 'round-robin',
        assignedChildIds: [1, 2, 3],
        linkedTaskId: 'task_a',
        linkedTaskOffset: 1,
        startDate: '2026-04-21',
      },
    });

    const tasks = [taskA, taskB];
    const dates = ['2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25'];

    // With reordered [1,3,2], task A rotates 1 -> 3 -> 2 -> 1 -> 3.
    const expectedA: number[] = [1, 3, 2, 1, 3];
    // Offset +1 in same order -> 3 -> 2 -> 1 -> 3 -> 2.
    const expectedB: number[] = [3, 2, 1, 3, 2];

    dates.forEach((date, index) => {
      const assignA = getTheoreticalAssignment(taskA, date, tasks);
      const assignB = getTheoreticalAssignment(taskB, date, tasks);
      expect(assignA).toHaveLength(1);
      expect(assignB).toHaveLength(1);
      expect(assignA[0].childId).toBe(expectedA[index]);
      expect(assignB[0].childId).toBe(expectedB[index]);
    });
  });
});
