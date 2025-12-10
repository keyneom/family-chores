
/**
 * Types and context for the Family Chores app global state.
 * Provides children, chores, and parent settings, as well as a provider and hook.
 */
import React, { createContext, useContext, useEffect, useReducer, ReactNode } from "react";
import Task, {
  TaskInstance,
  RecurrenceRule,
  ScheduleDefinition,
  RotationSettings,
  TaskAssignmentSettings,
  Weekday,
} from "../types/task";
import ActionLogEntry from "../types/actionLog";

// Legacy shapes used when reading old saved state
interface LegacyChore {
  id?: number | string;
  name?: string;
  title?: string;
  emoji?: string;
  color?: string;
  recurrence?: string;
  customDays?: number[];
  eligibleChildren?: number[];
  starReward?: number;
  moneyReward?: number;
  timed?: boolean;
  allowedSeconds?: number;
  latePenaltyPercent?: number;
  autoApproveOnStop?: boolean;
}

interface LegacyOneOff {
  id?: number | string;
  name?: string;
  emoji?: string;
  color?: string;
  starReward?: number;
  moneyReward?: number;
  date?: string;
  type?: string;
  assignedTo?: number;
  completed?: boolean;
  timed?: boolean;
  allowedSeconds?: number;
  latePenaltyPercent?: number;
}

/**
 * Represents a child in the family chores app.
 */
export interface Child {
  id: number;
  name: string;
  stars: number;
  money: number;
  // Optional blockchain address or ENS name for on-chain payments
  blockchainAddress?: string;
}

/**
 * @deprecated Legacy type - use unified Task type from types/task.ts instead
 * Kept for backward compatibility during migration
 */
export interface Chore {
  id: number;
  name: string;
  emoji: string;
  color: string;
  recurrence: string;
  customDays: number[];
  eligibleChildren: number[];
  starReward: number;
  moneyReward: number;
  // Timed task configuration
  timed?: boolean;
  // Allowed duration in seconds for the task
  allowedSeconds?: number;
  // Penalty (or modifier) applied when time is exceeded. Expressed as fraction (e.g. 0.5 = 50%). Can be negative to represent debt.
  latePenaltyPercent?: number;
  // If true, completions from child stopping the timer are auto-approved
  autoApproveOnStop?: boolean;
}

/**
 * @deprecated Legacy type - use unified Task type from types/task.ts instead
 * Kept for backward compatibility during migration
 */
export interface ChoreTemplate {
  id: number;
  name: string;
  emoji: string;
  color: string;
  stars: number;
  money: number;
  recurrence: string;
  customDays?: number[];
}

export interface ParentSettings {
  approvals: {
    taskMove: boolean;
    earlyComplete: boolean;
    taskComplete: boolean;
    editTasks: boolean;
  };
  // Default behavior for timed tasks: auto-approve on stop
  timedAutoApproveDefault?: boolean;
  // Support multiple named PINs (secure hashed storage)
  pins?: { handle: string; pinHash: string; salt: string }[];
  // Order of child columns (array of child IDs)
  childDisplayOrder?: number[];
  // Track if onboarding/tutorial has been completed or skipped
  onboardingCompleted?: boolean;
}

/**
 * @deprecated Legacy type - use unified Task type with oneOff property from types/task.ts instead
 * Kept for backward compatibility during migration
 */
export interface OneOffTask {
  id: number;
  name: string;
  emoji: string;
  color: string;
  starReward: number;
  moneyReward: number;
  date: string;
  type: 'any-child' | 'first-come' | 'all-children';
  assignedTo?: number;
  completed?: boolean;
  // Timed one-off task config
  timed?: boolean;
  allowedSeconds?: number;
  latePenaltyPercent?: number;
}

export interface ChoresAppState {
  children: Child[];
  // Task templates - definitions that generate instances
  tasks: Task[];
  // Task instances - actual occurrences that can be completed
  taskInstances: TaskInstance[];
  // In-memory audit log of actions taken in the app
  actionLog?: ActionLogEntry[];
  parentSettings: ParentSettings;
  // Legacy: completedTasks kept for backward compatibility during migration
  completedTasks: Record<string, boolean>;
  // Active timers keyed by timer id
  timers?: Record<string, Timer>;
  // Completed timed task records (for analytics / pending approvals)
  timedCompletions?: TimedCompletion[];
}

export interface Timer {
  id: string;
  taskKey: string;
  childId: number;
  startedAt: string; // ISO
  allowedSeconds: number;
}

export interface TimedCompletion {
  id: string;
  taskKey: string;
  childId: number;
  startedAt: string;
  stoppedAt: string;
  allowedSeconds: number;
  elapsedSeconds: number;
  rewardPercentage: number;
  starReward: number;
  // If true, completions from child stopping the timer are auto-approved
  autoApproveOnStop?: boolean;
  moneyReward: number;
  approved?: boolean; // parent approval for debts
  createdAt: string;
}

type ChoresAppAction =
  | { type: "ADD_CHILD"; payload: Child }
  | { type: "DELETE_CHILD"; payload: number }
  | { type: "ADD_TASK"; payload: Task }
  | { type: "UPDATE_TASK"; payload: Task }
  | { type: "DELETE_TASK"; payload: string } // template id
  | { type: "DISABLE_TASK_AFTER_DATE"; payload: { taskId: string; date: string } } // disable task after this date (ISO date string)
  | { type: "ADD_TASK_INSTANCE"; payload: TaskInstance }
  | { type: "UPDATE_TASK_INSTANCE"; payload: TaskInstance }
  | { type: "DELETE_TASK_INSTANCE"; payload: string } // instance id
  | { type: "COMPLETE_TASK"; payload: { taskKey: string; childId: number; starReward: number; moneyReward: number } } // Legacy
  | { type: "COMPLETE_TASK_INSTANCE"; payload: { instanceId: string; childId: number; starReward: number; moneyReward: number } }
  | { type: "PAY_CHILD"; payload: number }
  | { type: "START_TIMER"; payload: { timer: Timer } }
  | { type: "STOP_TIMER"; payload: { timerId: string; stoppedAt: string } }
  | { type: "ADD_PENDING_TIMED_COMPLETION"; payload: { completion: TimedCompletion } }
  | { type: "APPROVE_TIMED_COMPLETION"; payload: { completionId: string; approve: boolean; applyMoney?: boolean; actorHandle?: string | null } }
  | { type: "UPDATE_PARENT_SETTINGS"; payload: Partial<ParentSettings>; actorHandle?: string | null }
  | { type: "RESET_ALL_DATA" }
  | { type: "SET_STATE"; payload: ChoresAppState };

const defaultState: ChoresAppState = {
  children: [],
  tasks: [],
  parentSettings: {
    // legacy single PIN removed — the app now uses named approvers in `pins`
    approvals: {
      taskMove: false,
      earlyComplete: false,
      taskComplete: false,
      editTasks: false,
    },
    childDisplayOrder: [],
    timedAutoApproveDefault: false,
  },
  taskInstances: [],
  completedTasks: {},
  timers: {},
  timedCompletions: [],
  actionLog: [],
};

function sanitizeChildIds(input?: (number | string)[] | null): number[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const numeric = input
    .map((value) => {
      const num = typeof value === "string" ? parseInt(value, 10) : value;
      return Number.isFinite(num) ? num : null;
    })
    .filter((val): val is number => typeof val === "number" && !isNaN(val));
  if (numeric.length === 0) return undefined;
  return Array.from(new Set(numeric));
}

function getDefaultTimezone(): string | undefined {
  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || undefined;
  }
  return undefined;
}

function normalizeRecurrenceRule(rule: RecurrenceRule, task: Task): RecurrenceRule {
  const startDate = rule.startDate ?? task.createdAt?.split("T")[0];
  const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;
  const timezone = rule.timezone || task.schedule?.timezone || getDefaultTimezone();
  const startTime = rule.startTime || rule.timeOfDay || task.recurring?.timeOfDay;
  const excludeDates = rule.excludeDates ? Array.from(new Set(rule.excludeDates)) : undefined;
  const includeDates = rule.includeDates ? Array.from(new Set(rule.includeDates)) : undefined;
  const end =
    rule.end ??
    (rule.endDate
      ? { type: "afterDate", date: rule.endDate }
      : rule.count
      ? { type: "afterOccurrences", occurrences: rule.count }
      : undefined);

  return {
    ...rule,
    startDate,
    interval,
    timezone,
    startTime,
    timeOfDay: startTime ?? rule.timeOfDay,
    excludeDates,
    includeDates,
    end,
  };
}

function mapLegacyRecurringToSchedule(task: Task): ScheduleDefinition | undefined {
  const recurring = task.recurring;
  if (!recurring || !recurring.cadence) return undefined;

  const rule: RecurrenceRule = {
    frequency:
      recurring.cadence === "monthly"
        ? "monthly"
        : recurring.cadence === "weekly" || recurring.cadence === "custom-days" || recurring.cadence === "weekdays" || recurring.cadence === "weekends"
        ? "weekly"
        : "daily",
    interval: 1,
    timeOfDay: recurring.timeOfDay,
  };

  switch (recurring.cadence) {
    case "weekdays":
      rule.byWeekday = [1, 2, 3, 4, 5];
      break;
    case "weekends":
      rule.byWeekday = [0, 6];
      break;
    case "custom-days":
      if (recurring.customDays && recurring.customDays.length > 0) {
        rule.byWeekday = recurring.customDays as Weekday[];
      }
      break;
    default:
      break;
  }

  return {
    rule,
    dueTime: recurring.timeOfDay,
  };
}

function normalizeScheduleDefinition(task: Task): ScheduleDefinition | undefined {
  const baseSchedule = task.schedule ?? mapLegacyRecurringToSchedule(task);
  if (!baseSchedule) return undefined;
  const timezone = baseSchedule.timezone || task.schedule?.timezone || getDefaultTimezone();
  const rule = baseSchedule.rule ? normalizeRecurrenceRule(baseSchedule.rule, task) : undefined;

  return {
    ...baseSchedule,
    rule,
    timezone,
    dueTime: baseSchedule.dueTime || task.recurring?.timeOfDay,
    excludeDates: baseSchedule.excludeDates ? Array.from(new Set(baseSchedule.excludeDates)) : undefined,
    includeDates: baseSchedule.includeDates ? Array.from(new Set(baseSchedule.includeDates)) : undefined,
  };
}

function buildAssignmentSettings(task: Task, explicitIds?: number[]): TaskAssignmentSettings | undefined {
  const candidateIds =
    explicitIds ??
    (sanitizeChildIds(task.assignment?.childIds || []) ||
    sanitizeChildIds(task.rotation?.assignedChildIds || []) ||
    sanitizeChildIds(task.assignedChildIds || []) ||
    (typeof task.assignedTo !== "undefined" ? sanitizeChildIds([task.assignedTo]) : undefined));

  if (!candidateIds || candidateIds.length === 0) {
    return task.assignment ? { ...task.assignment, childIds: [] } : undefined;
  }

  const inferredStrategy =
    task.assignment?.strategy ||
    (task.rotation?.mode === "simultaneous"
      ? "simultaneous"
      : task.rotation?.mode === "round-robin"
      ? "round_robin"
      : candidateIds.length > 1
      ? "round_robin"
      : "single");

  const history =
    task.assignment?.history ||
    (task.rotation
      ? {
          lastAssignedChildId: task.rotation.lastAssignedChildId,
          lastRotationIndex: task.rotation.lastRotationIndex,
        }
      : undefined);

  return {
    strategy: inferredStrategy,
    childIds: candidateIds,
    rotationStartDate: task.assignment?.rotationStartDate ?? task.rotation?.startDate ?? task.createdAt,
    history,
    allowSimultaneous: task.assignment?.allowSimultaneous ?? task.rotation?.mode === "simultaneous",
    allowMultiplePerDay: task.assignment?.allowMultiplePerDay ?? false,
    groupId: task.assignment?.groupId ?? task.rotation?.groupId,
    sequenceId: task.assignment?.sequenceId,
  };
}

function buildRotationSettings(
  task: Task,
  assignedChildIds?: number[],
  assignment?: TaskAssignmentSettings,
): RotationSettings | undefined {
  const assignmentSettings = assignment ?? buildAssignmentSettings(task, assignedChildIds);
  if (!assignmentSettings) return undefined;

  const mode =
    assignmentSettings.strategy === "simultaneous"
      ? "simultaneous"
      : assignmentSettings.childIds.length > 1
      ? "round-robin"
      : "single-child";

  return {
    mode,
    assignedChildIds: assignmentSettings.childIds,
    lastAssignedChildId: assignmentSettings.history?.lastAssignedChildId,
    lastRotationIndex: assignmentSettings.history?.lastRotationIndex,
    startDate: assignmentSettings.rotationStartDate ?? task.createdAt,
    history: assignmentSettings.history,
    allowSimultaneous: assignmentSettings.allowSimultaneous,
    groupId: assignmentSettings.groupId,
  };
}

function normalizeTaskPayload(task: Task): Task {
  const assignedChildIds =
    sanitizeChildIds(task.assignedChildIds || []) ||
    (typeof task.assignedTo !== "undefined"
      ? sanitizeChildIds([task.assignedTo])
      : undefined);

  const assignment = buildAssignmentSettings(task, assignedChildIds);
  const rotation = buildRotationSettings(task, assignedChildIds, assignment);
  const schedule = normalizeScheduleDefinition(task);

  return {
    ...task,
    assignedChildIds,
    assignment,
    rotation,
    schedule,
  };
}

function makeLogEntry(actionType: string, payload?: unknown, actorHandle?: string | null): ActionLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    actionType,
    payload,
    actorHandle: actorHandle ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function choresAppReducer(state: ChoresAppState, action: ChoresAppAction): ChoresAppState {
  switch (action.type) {
    case "ADD_CHILD":
      return {
        ...state,
        children: [...state.children, action.payload],
        parentSettings: {
          ...state.parentSettings,
          childDisplayOrder: [...(state.parentSettings.childDisplayOrder || []), action.payload.id],
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_CHILD', { child: action.payload }) ],
      };
    case "DELETE_CHILD":
      return {
        ...state,
        children: state.children.filter(child => child.id !== action.payload),
        parentSettings: {
          ...state.parentSettings,
          childDisplayOrder: (state.parentSettings.childDisplayOrder || []).filter(id => id !== action.payload),
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DELETE_CHILD', { childId: action.payload }) ],
      };
    case "COMPLETE_TASK":
      return {
        ...state,
        completedTasks: {
          ...state.completedTasks,
          [action.payload.taskKey]: true,
        },
        children: state.children.map(child =>
          child.id === action.payload.childId
            ? {
                ...child,
                stars: child.stars + action.payload.starReward,
                money: child.money + action.payload.moneyReward,
              }
            : child
        ),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('COMPLETE_TASK', action.payload) ],
      };
    case "START_TIMER":
      return {
        ...state,
        timers: {
          ...(state.timers || {}),
          [action.payload.timer.id]: action.payload.timer,
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('START_TIMER', { timer: action.payload.timer }) ],
      };
    case "ADD_TASK": {
      const normalizedTask = normalizeTaskPayload(action.payload);
      return {
        ...state,
        tasks: [ ...state.tasks, normalizedTask ],
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_TASK', { task: normalizedTask }) ],
      };
    }
    case "UPDATE_TASK": {
      const normalizedTask = normalizeTaskPayload(action.payload);
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === normalizedTask.id ? normalizedTask : t),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('UPDATE_TASK', { task: normalizedTask }) ],
      };
    }
    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.payload),
        // Also remove instances for this template
        taskInstances: state.taskInstances.filter(inst => inst.templateId !== action.payload),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DELETE_TASK', { taskId: action.payload }) ],
      };
    case "DISABLE_TASK_AFTER_DATE":
      return {
        ...state,
        tasks: state.tasks.map(t => 
          t.id === action.payload.taskId 
            ? { ...t, disabledAfter: action.payload.date }
            : t
        ),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DISABLE_TASK_AFTER_DATE', { taskId: action.payload.taskId, date: action.payload.date }) ],
      };
    case "ADD_TASK_INSTANCE":
      // Check if instance already exists to prevent duplicates
      const existingInstance = state.taskInstances.find(inst => inst.id === action.payload.id);
      if (existingInstance) {
        // Instance already exists, return state unchanged
        return state;
      }
      return {
        ...state,
        taskInstances: [ ...state.taskInstances, action.payload ],
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_TASK_INSTANCE', { instance: action.payload }) ],
      };
    case "UPDATE_TASK_INSTANCE":
      return {
        ...state,
        taskInstances: state.taskInstances.map(inst => inst.id === action.payload.id ? action.payload : inst),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('UPDATE_TASK_INSTANCE', { instance: action.payload }) ],
      };
    case "DELETE_TASK_INSTANCE":
      return {
        ...state,
        taskInstances: state.taskInstances.filter(inst => inst.id !== action.payload),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DELETE_TASK_INSTANCE', { instanceId: action.payload }) ],
      };
    case "COMPLETE_TASK_INSTANCE": {
      const instance = state.taskInstances.find(inst => inst.id === action.payload.instanceId);
      if (!instance) return state;
      
      return {
        ...state,
        taskInstances: state.taskInstances.map(inst =>
          inst.id === action.payload.instanceId
            ? { ...inst, completed: true, completedAt: new Date().toISOString() }
            : inst
        ),
        children: state.children.map(child =>
          child.id === action.payload.childId
            ? {
                ...child,
                stars: child.stars + action.payload.starReward,
                money: child.money + action.payload.moneyReward,
              }
            : child
        ),
        // Legacy: also update completedTasks for backward compatibility
        completedTasks: {
          ...state.completedTasks,
          [`${instance.childId}-${instance.templateId}-${instance.date}`]: true,
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('COMPLETE_TASK_INSTANCE', action.payload) ],
      };
    }
    case "STOP_TIMER": {
      const timers = { ...(state.timers || {}) };
      const timer = timers[action.payload.timerId];
      if (!timer) return state;
      // compute elapsed and reward
      const started = new Date(timer.startedAt).getTime();
      const stopped = new Date(action.payload.stoppedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.round((stopped - started) / 1000));
      const allowed = timer.allowedSeconds;
      // Find task to get reward values (taskKey format: childId-taskId-date or legacy childId:choreId)
      let baseStarReward = 0;
      let baseMoneyReward = 0;
      let latePenalty = 0.5;
      let autoApprove = !!state.parentSettings.timedAutoApproveDefault;
      
      // Try to find task from taskKey (format: childId-taskId-date or legacy childId:choreId)
      const taskKeyParts = timer.taskKey.split('-');
      if (taskKeyParts.length >= 2) {
        // New format: childId-taskId-date (date is YYYY-MM-DD, so last 3 parts)
        // Extract taskId: everything between childId (first part) and date (last 3 parts)
        const taskId = taskKeyParts.length >= 5 
          ? taskKeyParts.slice(1, -3).join('-') // Has date: remove childId (first) and date (last 3)
          : taskKeyParts.slice(1).join('-'); // No date: just remove childId
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          baseStarReward = task.stars || 0;
          baseMoneyReward = task.money || 0;
          if (task.timed) {
            latePenalty = task.timed.latePenaltyPercent ?? 0.5;
            autoApprove = task.timed.autoApproveOnStop ?? autoApprove;
          }
        }
      } else if (timer.taskKey.includes(':')) {
        // Legacy format: childId:choreId (for backward compatibility during migration)
        const [, chorePart] = timer.taskKey.split(":");
        const choreId = parseInt(chorePart || "", 10);
        // Try to find task with legacy chore ID
        const task = state.tasks.find(t => t.id === `chore_${choreId}`);
        if (task) {
          baseStarReward = task.stars || 0;
          baseMoneyReward = task.money || 0;
          if (task.timed) {
            latePenalty = task.timed.latePenaltyPercent ?? 0.5;
            autoApprove = task.timed.autoApproveOnStop ?? autoApprove;
          }
        }
      }
      
      const rewardPercentage = elapsedSeconds <= allowed ? 1 : latePenalty;
      // Stars shouldn't scale; if completed on time give full stars, otherwise no stars for late completion
      const adjustedStars = elapsedSeconds <= allowed ? baseStarReward : 0;
      const adjustedMoney = +(baseMoneyReward * rewardPercentage);

      // remove timer
      delete timers[action.payload.timerId];

      const completion: TimedCompletion = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        taskKey: timer.taskKey,
        childId: timer.childId,
        startedAt: timer.startedAt,
        stoppedAt: action.payload.stoppedAt,
        allowedSeconds: allowed,
        elapsedSeconds,
        rewardPercentage,
        starReward: adjustedStars,
        moneyReward: adjustedMoney,
        approved: autoApprove,
        createdAt: new Date().toISOString(),
      };

      // Find and update the instance if it exists
      const updatedInstances = (state.taskInstances || []).map(inst => {
        // Match instance by taskKey pattern: childId-templateId-date
        const parts = timer.taskKey.split('-');
        const templateIdPart = parts[1];
        const datePart = parts[2];
        if (inst.childId === timer.childId && 
            inst.templateId === templateIdPart && 
            inst.date === datePart) {
          return {
            ...inst,
            completed: true,
            completedAt: action.payload.stoppedAt,
            timedCompletionId: completion.id,
          };
        }
        return inst;
      });

      let newState = {
        ...state,
        timers,
        taskInstances: updatedInstances,
        timedCompletions: [ ...(state.timedCompletions || []), completion ],
        completedTasks: {
          ...state.completedTasks,
          [timer.taskKey]: true,
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('STOP_TIMER', { timerId: action.payload.timerId, elapsedSeconds, taskKey: timer.taskKey, childId: timer.childId }) ],
      } as ChoresAppState;

      // If auto-approved, immediately apply rewards (money can be negative). Otherwise parent must approve.
      if (completion.approved) {
        newState = {
          ...newState,
          children: newState.children.map(child =>
            child.id === completion.childId
              ? { ...child, stars: child.stars + completion.starReward, money: +(child.money + completion.moneyReward) }
              : child
          ),
        } as ChoresAppState;
        // Log that auto-approval applied rewards
        newState.actionLog = [ ...(newState.actionLog || []), makeLogEntry('AUTO_APPROVE_TIMED_COMPLETION', { completionId: completion.id, childId: completion.childId }) ];
      }

      return newState;
    }
    case "ADD_PENDING_TIMED_COMPLETION":
      return {
        ...state,
        timedCompletions: [ ...(state.timedCompletions || []), action.payload.completion ],
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_PENDING_TIMED_COMPLETION', { completion: action.payload.completion }) ],
      };
    case "APPROVE_TIMED_COMPLETION": {
      const completions = (state.timedCompletions || []).map(c =>
        c.id === action.payload.completionId ? { ...c, approved: action.payload.approve } : c
      );
      // find the completion from existing state
      const comp = (state.timedCompletions || []).find(c => c.id === action.payload.completionId);
      let children = state.children;
      if (comp && action.payload.approve) {
        // apply stars always when approved
        children = state.children.map(child =>
          child.id === comp.childId
            ? { ...child, stars: child.stars + comp.starReward, money: +(child.money + (action.payload.applyMoney === false ? 0 : comp.moneyReward)) }
            : child
        );
      }
      return {
        ...state,
        timedCompletions: completions,
        children,
        actionLog: [ ...(state.actionLog || []), makeLogEntry('APPROVE_TIMED_COMPLETION', { completionId: action.payload.completionId, approve: action.payload.approve }, action.payload.actorHandle ?? null) ],
      };
    }
    // ADD_ONE_OFF_TASK removed - OneOffTaskModal now uses ADD_TASK + ADD_TASK_INSTANCE directly
    case "PAY_CHILD":
      return {
        ...state,
        children: state.children.map(child =>
          child.id === action.payload
            ? { ...child, money: 0 }
            : child
        ),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('PAY_CHILD', { childId: action.payload }) ],
      };
    case "UPDATE_PARENT_SETTINGS":
      return {
        ...state,
        parentSettings: {
          ...state.parentSettings,
          ...action.payload,
          // Deep merge approvals if provided
          ...(action.payload.approvals ? {
            approvals: {
              ...state.parentSettings.approvals,
              ...action.payload.approvals,
            }
          } : {}),
        },
        actionLog: [
          ...(state.actionLog || []),
          makeLogEntry('UPDATE_PARENT_SETTINGS', { updates: action.payload }, action.actorHandle ?? null)
        ],
      };
    case "RESET_ALL_DATA":
      return {
        ...defaultState,
        actionLog: [ ...(defaultState.actionLog || []), makeLogEntry('RESET_ALL_DATA') ],
      };
    case "SET_STATE":
      return {
        ...action.payload,
        tasks: (action.payload.tasks || []).map(normalizeTaskPayload),
      };
    default:
      return state;
  }
}

interface ChoresAppContextType {
  state: ChoresAppState;
  dispatch: React.Dispatch<ChoresAppAction>;
}

const ChoresAppContext = createContext<ChoresAppContextType | undefined>(undefined);

export function ChoresAppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(choresAppReducer, defaultState, (initial) => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("choresAppState");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as unknown as Record<string, unknown>;

          // If `tasks` already exists in saved state, prefer it. Otherwise
          // build a new `tasks` array from legacy `chores` and `oneOffTasks`.
          const existingTasks: Task[] = Array.isArray(parsed.tasks) ? (parsed.tasks as unknown as Task[]) : [];

          // Helper: map legacy chores to recurring tasks
          const rawChores = Array.isArray(parsed.chores) ? (parsed.chores as unknown[]) : [];
          const choresToTasks: Task[] = rawChores.map((cRaw) => {
            const c = cRaw as LegacyChore;
            const eligibleChildIds = sanitizeChildIds(c.eligibleChildren);
            return {
              id: `chore_${String(c.id ?? Math.random().toString(36).slice(2,8))}`,
              title: c.name || c.title || "",
              description: "",
              createdAt: new Date().toISOString(),
              type: 'recurring',
              enabled: true,
              stars: typeof c.starReward === 'number' ? c.starReward : 0,
              money: typeof c.moneyReward === 'number' ? c.moneyReward : 0,
              requirePin: false,
              recurring: { cadence: c.recurrence || 'daily' },
              assignedChildIds: eligibleChildIds,
              rotation: eligibleChildIds && eligibleChildIds.length > 0 ? {
                mode: eligibleChildIds.length > 1 ? 'round-robin' : 'single-child',
                assignedChildIds: eligibleChildIds,
              } : undefined,
            } as Task;
          });

          // Map one-off tasks (object keyed by date) into oneoff Task entries
          const oneOffs: Task[] = [];
          const oneOffData = (parsed.oneOffTasks && typeof parsed.oneOffTasks === 'object') ? (parsed.oneOffTasks as Record<string, unknown>) : {};
          Object.keys(oneOffData).forEach((dateKey) => {
            const arr = Array.isArray(oneOffData[dateKey]) ? (oneOffData[dateKey] as unknown[]) : [];
            arr.forEach((oRaw) => {
              const o = oRaw as LegacyOneOff;
              oneOffs.push({
                id: `oneoff_${String(o.id ?? Math.random().toString(36).slice(2,8))}`,
                title: o.name || "",
                description: "",
                createdAt: new Date().toISOString(),
                type: 'oneoff',
                enabled: true,
                stars: typeof o.starReward === 'number' ? o.starReward : 0,
                money: typeof o.moneyReward === 'number' ? o.moneyReward : 0,
                requirePin: false,
                oneOff: { dueDate: o.date || dateKey },
                completed: !!o.completed,
              } as Task);
            });
          });

          const mergedTasks = existingTasks.length > 0 ? existingTasks : [ ...choresToTasks, ...oneOffs ];

          // Ensure tasks is always an array
          const finalTasks: Task[] = Array.isArray(mergedTasks) && mergedTasks.length > 0 ? mergedTasks : initial.tasks;
          const normalizedTasks = finalTasks.map(normalizeTaskPayload);

          // Load taskInstances if they exist, otherwise start with empty array
          const existingInstances: TaskInstance[] = Array.isArray(parsed.taskInstances) ? (parsed.taskInstances as unknown as TaskInstance[]) : [];
          
          // Remove duplicate instances (keep first occurrence of each unique ID or unique templateId+childId+date combination)
          const uniqueInstances: TaskInstance[] = [];
          const seenIds = new Set<string>();
          const seenKeys = new Set<string>(); // For templateId-childId-date combinations
          
          for (const instance of existingInstances) {
            // Check by ID first
            if (instance.id && !seenIds.has(instance.id)) {
              // Also check by unique key (templateId-childId-date) to catch duplicates with different IDs
              const uniqueKey = `${instance.templateId}-${instance.childId}-${instance.date}`;
              if (!seenKeys.has(uniqueKey)) {
                seenIds.add(instance.id);
                seenKeys.add(uniqueKey);
                uniqueInstances.push(instance);
              }
            }
          }

          return {
            ...initial,
            children: Array.isArray(parsed.children) ? (parsed.children as unknown as Child[]) : initial.children,
            tasks: normalizedTasks,
            taskInstances: uniqueInstances,
            completedTasks: (parsed.completedTasks && typeof parsed.completedTasks === 'object') ? (parsed.completedTasks as unknown as Record<string, boolean>) : initial.completedTasks,
            timers: (parsed.timers && typeof parsed.timers === 'object') ? (parsed.timers as unknown as Record<string, Timer>) : initial.timers,
            timedCompletions: Array.isArray(parsed.timedCompletions) ? (parsed.timedCompletions as unknown as TimedCompletion[]) : initial.timedCompletions,
            actionLog: Array.isArray(parsed.actionLog) ? (parsed.actionLog as unknown as ActionLogEntry[]) : initial.actionLog,
            parentSettings: (parsed.parentSettings && typeof parsed.parentSettings === 'object') ? (parsed.parentSettings as unknown as ParentSettings) : initial.parentSettings,
          };
        } catch {
          return initial;
        }
      }
    }
    return initial;
  });

  useEffect(() => {
    localStorage.setItem("choresAppState", JSON.stringify(state));
  }, [state]);

  return (
    <ChoresAppContext.Provider value={{ state, dispatch }}>
      {children}
    </ChoresAppContext.Provider>
  );
}

export function useChoresApp() {
  const context = useContext(ChoresAppContext);
  if (!context) throw new Error("useChoresApp must be used within ChoresAppProvider");
  return context;
}
