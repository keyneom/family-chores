import { choresAppReducer, ChoresAppState, Chore, Child } from '../components/ChoresAppContext';
import type Task from '../types/task';

describe('ChoresAppContext Reducer', () => {
  const createInitialState = (): ChoresAppState => ({
    children: [
      { id: 1, name: 'Child 1', stars: 0, money: 0 },
      { id: 2, name: 'Child 2', stars: 0, money: 0 },
    ],
    parentSettings: {
      approvals: {
        taskMove: false,
        earlyComplete: false,
        taskComplete: false,
        editTasks: false,
      },
      timedAutoApproveDefault: false,
    },
    completedTasks: {},
    timers: {},
    timedCompletions: [],
    tasks: [],
    taskInstances: [],
    actionLog: [],
  });

  describe('ADD_TASK', () => {
    it('should add a new task to the tasks array', () => {
      const initialState = createInitialState();
      const newTask: Task = {
        id: 'task_1',
        title: 'Test Task',
        description: 'Test description',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 5,
        money: 10.0,
        recurring: { cadence: 'daily' },
      };

      const newState = choresAppReducer(initialState, {
        type: 'ADD_TASK',
        payload: newTask,
      });

      expect(newState.tasks).toHaveLength(1);
      expect(newState.tasks?.[0]).toMatchObject({
        id: newTask.id,
        title: newTask.title,
        stars: newTask.stars,
        money: newTask.money,
        type: newTask.type,
      });
    });

    it('should add multiple tasks', () => {
      const initialState = createInitialState();
      const task1: Task = {
        id: 'task_1',
        title: 'Task 1',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 1,
        money: 1.0,
        recurring: { cadence: 'daily' },
      };
      const task2: Task = {
        id: 'task_2',
        title: 'Task 2',
        createdAt: new Date().toISOString(),
        type: 'timed',
        enabled: true,
        stars: 2,
        money: 2.0,
        timed: {
          allowedSeconds: 300,
          latePenaltyPercent: 0.5,
        },
      };

      let newState = choresAppReducer(initialState, {
        type: 'ADD_TASK',
        payload: task1,
      });
      newState = choresAppReducer(newState, {
        type: 'ADD_TASK',
        payload: task2,
      });

      expect(newState.tasks).toHaveLength(2);
      expect(newState.tasks?.[0]).toMatchObject({ id: task1.id, title: task1.title });
      expect(newState.tasks?.[1]).toMatchObject({ id: task2.id, title: task2.title });
    });
  });

  describe('UPDATE_TASK', () => {
    it('should update an existing task', () => {
      const initialState = createInitialState();
      const task: Task = {
        id: 'task_1',
        title: 'Original Title',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 1,
        money: 1.0,
        recurring: { cadence: 'daily' },
      };
      initialState.tasks = [task];

      const updatedTask: Task = {
        ...task,
        title: 'Updated Title',
        stars: 10,
      };

      const newState = choresAppReducer(initialState, {
        type: 'UPDATE_TASK',
        payload: updatedTask,
      });

      expect(newState.tasks).toHaveLength(1);
      expect(newState.tasks?.[0].title).toBe('Updated Title');
      expect(newState.tasks?.[0].stars).toBe(10);
    });

    it('should not update if task id does not exist', () => {
      const initialState = createInitialState();
      const task: Task = {
        id: 'task_1',
        title: 'Task 1',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 1,
        money: 1.0,
        recurring: { cadence: 'daily' },
      };
      initialState.tasks = [task];

      const nonExistentTask: Task = {
        id: 'task_999',
        title: 'Non-existent',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 1,
        money: 1.0,
        recurring: { cadence: 'daily' },
      };

      const newState = choresAppReducer(initialState, {
        type: 'UPDATE_TASK',
        payload: nonExistentTask,
      });

      expect(newState.tasks).toHaveLength(1);
      expect(newState.tasks?.[0].id).toBe('task_1');
    });
  });

  describe('task normalization', () => {
    it('creates assignment metadata for legacy tasks', () => {
      const initialState = createInitialState();
      const legacyTask: Task = {
        id: 'task_assign',
        title: 'Rotate chores',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 1,
        money: 0,
        assignedChildIds: [1, 2],
        recurring: { cadence: 'daily', timeOfDay: '08:00' },
      };

      const newState = choresAppReducer(initialState, {
        type: 'ADD_TASK',
        payload: legacyTask,
      });

      const savedTask = newState.tasks?.[0];
      expect(savedTask?.assignment?.childIds).toEqual([1, 2]);
      expect(savedTask?.assignment?.strategy).toBe('round_robin');
      expect(savedTask?.rotation?.mode).toBe('round-robin');
    });

    it('builds schedule definitions from recurring cadence', () => {
      const initialState = createInitialState();
      const legacyTask: Task = {
        id: 'task_schedule',
        title: 'Weekday task',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 1,
        money: 0,
        recurring: { cadence: 'weekdays', timeOfDay: '17:00' },
      };

      const newState = choresAppReducer(initialState, {
        type: 'ADD_TASK',
        payload: legacyTask,
      });

      const savedTask = newState.tasks?.[0];
      expect(savedTask?.schedule?.rule?.frequency).toBe('weekly');
      expect(savedTask?.schedule?.rule?.byWeekday).toEqual([1, 2, 3, 4, 5]);
      expect(savedTask?.schedule?.dueTime).toBe('17:00');
    });

    it('normalizes tasks provided via SET_STATE', () => {
      const migratedTask: Task = {
        id: 'task_state',
        title: 'Migrated',
        createdAt: new Date().toISOString(),
        type: 'recurring',
        enabled: true,
        stars: 1,
        money: 0,
        assignedChildIds: [1],
        recurring: { cadence: 'daily' },
      };

      const newState = choresAppReducer(createInitialState(), {
        type: 'SET_STATE',
        payload: {
          ...createInitialState(),
          tasks: [migratedTask],
        },
      });

      expect(newState.tasks?.[0].assignment?.childIds).toEqual([1]);
      expect(newState.tasks?.[0].schedule?.rule?.frequency).toBe('daily');
    });
  });

  describe('COMPLETE_TASK', () => {
    it('should mark task as completed and apply rewards', () => {
      const initialState = createInitialState();
      const taskKey = '1-task_1-2024-01-01';

      const newState = choresAppReducer(initialState, {
        type: 'COMPLETE_TASK',
        payload: {
          taskKey,
          childId: 1,
          starReward: 5,
          moneyReward: 10.0,
        },
      });

      expect(newState.completedTasks[taskKey]).toBe(true);
      const child = newState.children.find(c => c.id === 1);
      expect(child?.stars).toBe(5);
      expect(child?.money).toBe(10.0);
      expect(newState.actionLog?.length).toBeGreaterThan(0);
    });
  });

  describe('ADD_CHILD', () => {
    it('should add a new child', () => {
      const initialState = createInitialState();
      const newChild: Child = {
        id: 3,
        name: 'Child 3',
        stars: 0,
        money: 0,
      };

      const newState = choresAppReducer(initialState, {
        type: 'ADD_CHILD',
        payload: newChild,
      });

      expect(newState.children).toHaveLength(3);
      expect(newState.children[2]).toEqual(newChild);
      expect(newState.actionLog?.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE_CHILD', () => {
    it('should remove a child by id', () => {
      const initialState = createInitialState();

      const newState = choresAppReducer(initialState, {
        type: 'DELETE_CHILD',
        payload: 1,
      });

      expect(newState.children).toHaveLength(1);
      expect(newState.children[0].id).toBe(2);
    });
  });

  describe('Approval workflows with actorHandle tracking', () => {
    it('should track actorHandle in action log for approvals', () => {
      const initialState = createInitialState();
      const completion = {
        id: 'completion_123',
        taskKey: '1:1',
        childId: 1,
        startedAt: new Date().toISOString(),
        stoppedAt: new Date().toISOString(),
        allowedSeconds: 300,
        elapsedSeconds: 240,
        rewardPercentage: 1,
        starReward: 5,
        moneyReward: 10.0,
        approved: false,
        createdAt: new Date().toISOString(),
      };
      initialState.timedCompletions = [completion];

      const newState = choresAppReducer(initialState, {
        type: 'APPROVE_TIMED_COMPLETION',
        payload: {
          completionId: completion.id,
          approve: true,
          applyMoney: true,
          actorHandle: 'parent1',
        },
      });

      const logEntry = newState.actionLog?.find(log => log.actionType === 'APPROVE_TIMED_COMPLETION');
      expect(logEntry?.actorHandle).toBe('parent1');
    });
  });

  describe('REPLACE_TASK_INSTANCES', () => {
    it('replaces uncompleted instances from a start date while keeping completed history', () => {
      const initialState = createInitialState();
      initialState.taskInstances = [
        { id: 'past-complete', templateId: 'task_1', childId: 1, date: '2024-01-01', completed: true, createdAt: new Date().toISOString() },
        { id: 'today-old', templateId: 'task_1', childId: 1, date: '2024-01-10', completed: false, createdAt: new Date().toISOString() },
        { id: 'future-old', templateId: 'task_1', childId: 1, date: '2024-01-11', completed: false, createdAt: new Date().toISOString() },
      ];

      const replacement = { id: 'today-new', templateId: 'task_1', childId: 2, date: '2024-01-10', completed: false, createdAt: new Date().toISOString() };

      const newState = choresAppReducer(initialState, {
        type: 'REPLACE_TASK_INSTANCES',
        payload: {
          taskId: 'task_1',
          startDate: '2024-01-10',
          instances: [replacement],
          preserveCompleted: true,
        },
      });

      expect(newState.taskInstances.find(inst => inst.id === 'past-complete')).toBeDefined();
      expect(newState.taskInstances.find(inst => inst.id === 'today-old')).toBeUndefined();
      expect(newState.taskInstances.find(inst => inst.id === 'future-old')).toBeUndefined();
      expect(newState.taskInstances.find(inst => inst.id === 'today-new')?.childId).toBe(2);
    });
  });
});


