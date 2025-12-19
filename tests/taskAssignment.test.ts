import { assignTaskToChild } from '../utils/taskAssignment';
import { Child } from '../components/ChoresAppContext';
import type { Task } from '../types/task';

describe('taskAssignment', () => {
  const children: Child[] = [
    { id: 1, name: 'Alice', stars: 0, money: 0 },
    { id: 2, name: 'Bob', stars: 0, money: 0 },
    { id: 3, name: 'Charlie', stars: 0, money: 0 },
  ];

  it('assigns to single child when mode is single-child', () => {
    const task: Task = {
      id: 'task_1',
      title: 'Test Task',
      createdAt: new Date().toISOString(),
      type: 'recurring',
      rotation: {
        mode: 'single-child',
        assignedChildIds: [1],
        startDate: '2024-01-01',
      },
    };

    const assignments = assignTaskToChild(task, children, { date: '2024-01-01' }, [task]);
    expect(assignments).toHaveLength(1);
    expect(assignments[0].child.id).toBe(1);
  });

  it('assigns to all children when mode is simultaneous', () => {
    const task: Task = {
      id: 'task_2',
      title: 'Test Task',
      createdAt: new Date().toISOString(),
      type: 'recurring',
      rotation: {
        mode: 'simultaneous',
        assignedChildIds: [1, 2, 3],
        startDate: '2024-01-01',
      },
    };

    const assignments = assignTaskToChild(task, children, { date: '2024-01-01' }, [task]);
    expect(assignments).toHaveLength(3);
    expect(assignments.map(a => a.child.id).sort()).toEqual([1, 2, 3]);
  });

  it('rotates through children in round-robin mode', () => {
    const task: Task = {
      id: 'task_3',
      title: 'Test Task',
      createdAt: new Date().toISOString(),
      type: 'recurring',
      rotation: {
        mode: 'round-robin',
        assignedChildIds: [1, 2],
        startDate: '2024-01-01',
      },
    };

    const day1 = assignTaskToChild(task, children, { date: '2024-01-01' }, [task]);
    const day2 = assignTaskToChild(task, children, { date: '2024-01-02' }, [task]);
    const day3 = assignTaskToChild(task, children, { date: '2024-01-03' }, [task]);

    expect(day1).toHaveLength(1);
    expect(day2).toHaveLength(1);
    expect(day3).toHaveLength(1);
    
    // Should rotate between the two assigned children
    const day1Id = day1[0].child.id;
    const day2Id = day2[0].child.id;
    const day3Id = day3[0].child.id;
    
    expect([day1Id, day2Id, day3Id].filter(id => [1, 2].includes(id)).length).toBe(3);
  });

  it('returns empty array when no children match', () => {
    const task: Task = {
      id: 'task_4',
      title: 'Test Task',
      createdAt: new Date().toISOString(),
      type: 'recurring',
      rotation: {
        mode: 'single-child',
        assignedChildIds: [999], // Non-existent child
        startDate: '2024-01-01',
      },
    };

    const assignments = assignTaskToChild(task, children, { date: '2024-01-01' }, [task]);
    expect(assignments).toHaveLength(0);
  });

  it('falls back to all children when no assignment specified', () => {
    const task: Task = {
      id: 'task_5',
      title: 'Test Task',
      createdAt: new Date().toISOString(),
      type: 'recurring',
    };

    const assignments = assignTaskToChild(task, children, { date: '2024-01-01' }, [task]);
    expect(assignments.length).toBeGreaterThan(0);
  });

  it('supports linked rotation offsets without cycles', () => {
    const sourceTask: Task = {
      id: 'task_source',
      title: 'Source',
      createdAt: new Date().toISOString(),
      type: 'recurring',
      rotation: {
        mode: 'round-robin',
        assignedChildIds: [1, 2, 3],
        rotationOrder: [1, 2, 3],
        startDate: '2024-01-01',
      },
    };

    const offsetTask: Task = {
      id: 'task_offset',
      title: 'Offset follower',
      createdAt: new Date().toISOString(),
      type: 'recurring',
      rotation: {
        mode: 'round-robin',
        assignedChildIds: [1, 2, 3],
        linkedTaskId: 'task_source',
        linkedTaskOffset: 1,
        startDate: '2024-01-01',
      },
    };

    const day1 = assignTaskToChild(offsetTask, children, { date: '2024-01-01' }, [sourceTask, offsetTask]);
    const day2 = assignTaskToChild(offsetTask, children, { date: '2024-01-02' }, [sourceTask, offsetTask]);

    expect(day1[0].child.id).toBe(2); // source day1 child 1, offset +1 => child 2
    expect(day2[0].child.id).toBe(3); // source day2 child 2, offset +1 => child 3
  });
});





