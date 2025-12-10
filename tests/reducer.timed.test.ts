import { choresAppReducer, ChoresAppState, Timer, TimedCompletion } from '../components/ChoresAppContext';
import type { Task } from '../types/task';

describe('Timed Task Reducer', () => {
  const createInitialState = (): ChoresAppState => {
    // Use task ID without underscores to avoid parsing issues with taskKey format
    const testTask: Task = {
      id: 'task1', // Simple ID without underscores for easier parsing
      title: 'Test Task',
      description: '',
      createdAt: new Date().toISOString(),
      enabled: true,
      type: 'timed',
      stars: 5,
      money: 10.0,
      timed: {
        allowedSeconds: 300, // 5 minutes
        latePenaltyPercent: 0.5, // 50% when late
        autoApproveOnStop: false,
        allowNegative: false,
      },
    };

    return {
      children: [
        { id: 1, name: 'Child 1', stars: 0, money: 0 },
        { id: 2, name: 'Child 2', stars: 0, money: 0 },
      ],
      tasks: [testTask],
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
      },
      completedTasks: {},
      timers: {},
      timedCompletions: [],
      actionLog: [],
    };
  };

  describe('START_TIMER', () => {
    it('should create a timer in state', () => {
      const initialState = createInitialState();
      const timer: Timer = {
        id: 'timer_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: new Date().toISOString(),
        allowedSeconds: 300,
      };

      const newState = choresAppReducer(initialState, {
        type: 'START_TIMER',
        payload: { timer },
      });

      expect(newState.timers).toBeDefined();
      expect(newState.timers?.[timer.id]).toEqual(timer);
      expect(newState.actionLog?.length).toBeGreaterThan(0);
      const lastLog = newState.actionLog?.[newState.actionLog.length - 1];
      expect(lastLog?.actionType).toBe('START_TIMER');
    });

    it('should preserve existing timers when adding a new one', () => {
      const initialState = createInitialState();
      const existingTimer: Timer = {
        id: 'timer_1',
        taskKey: '1:1',
        childId: 1,
        startedAt: new Date().toISOString(),
        allowedSeconds: 300,
      };
      initialState.timers = { [existingTimer.id]: existingTimer };

      const newTimer: Timer = {
        id: 'timer_2',
        taskKey: '2-task_1-2024-01-01', // Format: childId-taskId-date
        childId: 2,
        startedAt: new Date().toISOString(),
        allowedSeconds: 300,
      };

      const newState = choresAppReducer(initialState, {
        type: 'START_TIMER',
        payload: { timer: newTimer },
      });

      expect(newState.timers?.[existingTimer.id]).toEqual(existingTimer);
      expect(newState.timers?.[newTimer.id]).toEqual(newTimer);
    });
  });

  describe('STOP_TIMER', () => {
    it('should calculate elapsed seconds correctly for on-time completion', () => {
      const initialState = createInitialState();
      const startTime = new Date('2024-01-01T10:00:00Z');
      const stopTime = new Date('2024-01-01T10:04:00Z'); // 4 minutes = 240 seconds (within 300s limit)

      const timer: Timer = {
        id: 'timer_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: startTime.toISOString(),
        allowedSeconds: 300,
      };
      initialState.timers = { [timer.id]: timer };

      const newState = choresAppReducer(initialState, {
        type: 'STOP_TIMER',
        payload: { timerId: timer.id, stoppedAt: stopTime.toISOString() },
      });

      expect(newState.timers?.[timer.id]).toBeUndefined(); // Timer should be removed
      expect(newState.timedCompletions?.length).toBe(1);
      const completion = newState.timedCompletions?.[0];
      expect(completion?.elapsedSeconds).toBe(240);
      expect(completion?.rewardPercentage).toBe(1); // Full reward for on-time
      expect(completion?.starReward).toBe(5); // Full stars
      expect(completion?.moneyReward).toBe(10.0); // Full money
    });

    it('should apply late penalty for late completion', () => {
      const initialState = createInitialState();
      const startTime = new Date('2024-01-01T10:00:00Z');
      const stopTime = new Date('2024-01-01T10:06:00Z'); // 6 minutes = 360 seconds (60s over limit)

      const timer: Timer = {
        id: 'timer_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: startTime.toISOString(),
        allowedSeconds: 300,
      };
      initialState.timers = { [timer.id]: timer };

      const newState = choresAppReducer(initialState, {
        type: 'STOP_TIMER',
        payload: { timerId: timer.id, stoppedAt: stopTime.toISOString() },
      });

      const completion = newState.timedCompletions?.[0];
      expect(completion?.elapsedSeconds).toBe(360);
      expect(completion?.rewardPercentage).toBe(0.5); // 50% penalty
      expect(completion?.starReward).toBe(0); // No stars for late completion
      expect(completion?.moneyReward).toBe(5.0); // 50% of 10.0
    });

    it('should handle large-late completion causing negative money', () => {
      const initialState = createInitialState();
      // Update task with negative penalty
      initialState.tasks[0] = {
        ...initialState.tasks[0],
        money: 20.0,
        timed: {
          ...initialState.tasks[0].timed!,
          latePenaltyPercent: -0.5, // Negative penalty (debt)
        },
      };

      const startTime = new Date('2024-01-01T10:00:00Z');
      const stopTime = new Date('2024-01-01T10:10:00Z'); // 10 minutes = 600 seconds (300s over limit)

      const timer: Timer = {
        id: 'timer_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: startTime.toISOString(),
        allowedSeconds: 300,
      };
      initialState.timers = { [timer.id]: timer };

      const newState = choresAppReducer(initialState, {
        type: 'STOP_TIMER',
        payload: { timerId: timer.id, stoppedAt: stopTime.toISOString() },
      });

      const completion = newState.timedCompletions?.[0];
      expect(completion?.elapsedSeconds).toBe(600);
      expect(completion?.rewardPercentage).toBe(-0.5);
      expect(completion?.moneyReward).toBe(-10.0); // Negative money (debt)
    });

    it('should auto-approve and apply rewards when autoApproveOnStop is true', () => {
      const initialState = createInitialState();
      // Update task with auto-approve
      initialState.tasks[0] = {
        ...initialState.tasks[0],
        timed: {
          ...initialState.tasks[0].timed!,
          autoApproveOnStop: true,
        },
      };

      const startTime = new Date('2024-01-01T10:00:00Z');
      const stopTime = new Date('2024-01-01T10:04:00Z');

      const timer: Timer = {
        id: 'timer_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: startTime.toISOString(),
        allowedSeconds: 300,
      };
      initialState.timers = { [timer.id]: timer };

      const newState = choresAppReducer(initialState, {
        type: 'STOP_TIMER',
        payload: { timerId: timer.id, stoppedAt: stopTime.toISOString() },
      });

      const completion = newState.timedCompletions?.[0];
      expect(completion?.approved).toBe(true);

      const child = newState.children.find(c => c.id === 1);
      expect(child?.stars).toBe(5); // Rewards applied
      expect(child?.money).toBe(10.0);

      // Should log auto-approval
      const autoApproveLog = newState.actionLog?.find(log => log.actionType === 'AUTO_APPROVE_TIMED_COMPLETION');
      expect(autoApproveLog).toBeDefined();
    });

    it('should not apply rewards when autoApproveOnStop is false', () => {
      const initialState = createInitialState();
      // Ensure auto-approve is false
      initialState.tasks[0] = {
        ...initialState.tasks[0],
        timed: {
          ...initialState.tasks[0].timed!,
          autoApproveOnStop: false,
        },
      };

      const startTime = new Date('2024-01-01T10:00:00Z');
      const stopTime = new Date('2024-01-01T10:04:00Z');

      const timer: Timer = {
        id: 'timer_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: startTime.toISOString(),
        allowedSeconds: 300,
      };
      initialState.timers = { [timer.id]: timer };

      const newState = choresAppReducer(initialState, {
        type: 'STOP_TIMER',
        payload: { timerId: timer.id, stoppedAt: stopTime.toISOString() },
      });

      const completion = newState.timedCompletions?.[0];
      expect(completion?.approved).toBe(false);

      const child = newState.children.find(c => c.id === 1);
      expect(child?.stars).toBe(0); // Rewards not applied yet
      expect(child?.money).toBe(0);
    });

    it('should use parent default autoApprove when chore-level setting is not defined', () => {
      const initialState = createInitialState();
      // Remove autoApproveOnStop from task (undefined)
      initialState.tasks[0] = {
        ...initialState.tasks[0],
        timed: {
          ...initialState.tasks[0].timed!,
          autoApproveOnStop: undefined,
        },
      };
      initialState.parentSettings.timedAutoApproveDefault = true;

      const startTime = new Date('2024-01-01T10:00:00Z');
      const stopTime = new Date('2024-01-01T10:04:00Z');

      const timer: Timer = {
        id: 'timer_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: startTime.toISOString(),
        allowedSeconds: 300,
      };
      initialState.timers = { [timer.id]: timer };

      const newState = choresAppReducer(initialState, {
        type: 'STOP_TIMER',
        payload: { timerId: timer.id, stoppedAt: stopTime.toISOString() },
      });

      const completion = newState.timedCompletions?.[0];
      expect(completion?.approved).toBe(true);
    });

    it('should return state unchanged if timer does not exist', () => {
      const initialState = createInitialState();

      const newState = choresAppReducer(initialState, {
        type: 'STOP_TIMER',
        payload: { timerId: 'nonexistent', stoppedAt: new Date().toISOString() },
      });

      expect(newState).toEqual(initialState);
    });
  });

  describe('APPROVE_TIMED_COMPLETION', () => {
    it('should record actorHandle correctly and apply rewards', () => {
      const initialState = createInitialState();
      const completion: TimedCompletion = {
        id: 'completion_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
        stoppedAt: new Date('2024-01-01T10:04:00Z').toISOString(),
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

      const updatedCompletion = newState.timedCompletions?.find(c => c.id === completion.id);
      expect(updatedCompletion?.approved).toBe(true);

      const child = newState.children.find(c => c.id === 1);
      expect(child?.stars).toBe(5);
      expect(child?.money).toBe(10.0);

      const logEntry = newState.actionLog?.find(log => log.actionType === 'APPROVE_TIMED_COMPLETION');
      expect(logEntry?.actorHandle).toBe('parent1');
    });

    it('should apply stars but not money when applyMoney is false', () => {
      const initialState = createInitialState();
      const completion: TimedCompletion = {
        id: 'completion_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
        stoppedAt: new Date('2024-01-01T10:04:00Z').toISOString(),
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
          applyMoney: false,
          actorHandle: 'parent1',
        },
      });

      const child = newState.children.find(c => c.id === 1);
      expect(child?.stars).toBe(5); // Stars applied
      expect(child?.money).toBe(0); // Money not applied
    });

    it('should not apply rewards when approve is false', () => {
      const initialState = createInitialState();
      const completion: TimedCompletion = {
        id: 'completion_123',
        taskKey: '1-task1-2024-01-01', // Format: childId-taskId-date
        childId: 1,
        startedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
        stoppedAt: new Date('2024-01-01T10:04:00Z').toISOString(),
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
          approve: false,
          applyMoney: true,
          actorHandle: 'parent1',
        },
      });

      const updatedCompletion = newState.timedCompletions?.find(c => c.id === completion.id);
      expect(updatedCompletion?.approved).toBe(false);

      const child = newState.children.find(c => c.id === 1);
      expect(child?.stars).toBe(0); // No rewards applied
      expect(child?.money).toBe(0);
    });
  });
});

