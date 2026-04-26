
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
import { parseTaskKey } from "../utils/taskKey";
import { deriveDueTimeFromCron } from "../utils/recurrenceBuilder";
import { getLocalDateTimeString, parseLocalDate } from "../utils/dateUtils";
import {
  applyUndonePenaltyIfDue,
  legacyTimedToConsequenceRules,
  resolveMissConsequenceOutcome,
  resolveTimedOutcome,
} from "../utils/consequenceEngine";
import { applyQualityMultiplier, clampQualityPercent } from "../utils/qualityScoreUtils";
import { getOverdueState, resolveCarryOverState } from "../utils/projectionUtils";

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
  // Money payout multiplier when time is exceeded: 0.5 = half reward, 0 = none, -0.5 = debt.
  // Undefined falls back to the app's half-reward default for legacy timed tasks.
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

export interface VoiceAnnouncementSettings {
  enabled: boolean;
  volume: number; // 0-1
  rate: number; // 0.1-10, default ~1
  pitch: number; // 0-2, default 1
  // Timer-specific settings
  timerAnnouncements?: {
    enabled: boolean;
    announceAtPercentages?: number[]; // e.g., [0.5, 0.75, 0.9]
    announceAtSecondsRemaining?: number[]; // e.g., [60, 30, 10]
    announceAtStart?: boolean;
    messageFormat?: string;
  };
  // Scheduled task-specific settings
  scheduledAnnouncements?: {
    enabled: boolean;
    announceMinutesBefore?: number[]; // e.g., [15, 5]
    announceAtDueTime?: boolean;
    messageFormat?: string;
  };
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
  // Voice announcement settings
  voiceAnnouncements?: VoiceAnnouncementSettings;
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
  | { type: "ADD_CHILD"; payload: Child; actorHandle?: string | null }
  | { type: "DELETE_CHILD"; payload: number; actorHandle?: string | null }
  | { type: "UPDATE_CHILD"; payload: Child; actorHandle?: string | null }
  | { type: "ADD_TASK"; payload: Task; actorHandle?: string | null }
  | { type: "UPDATE_TASK"; payload: Task; actorHandle?: string | null }
  | { type: "DELETE_TASK"; payload: string; actorHandle?: string | null } // template id
  | { type: "DISABLE_TASK_AFTER_DATE"; payload: { taskId: string; date: string }; actorHandle?: string | null } // disable task after this date (ISO date string)
  | { type: "ADD_TASK_INSTANCE"; payload: TaskInstance; actorHandle?: string | null }
  | { type: "REPLACE_TASK_INSTANCES"; payload: { taskId: string; startDate?: string; instances: TaskInstance[]; preserveCompleted?: boolean } }
  | { type: "UPDATE_TASK_INSTANCE"; payload: TaskInstance; actorHandle?: string | null }
  | { type: "DELETE_TASK_INSTANCE"; payload: string; actorHandle?: string | null } // instance id
  | { type: "COMPLETE_TASK"; payload: { taskKey: string; childId: number; starReward: number; moneyReward: number; qualityScorePercent?: number }; actorHandle?: string | null } // Legacy
  | { type: "COMPLETE_TASK_INSTANCE"; payload: { instanceId: string; childId: number; starReward: number; moneyReward: number; qualityScorePercent?: number }; actorHandle?: string | null }
  | { type: "RESET_TASK_PROGRESS"; payload: { taskKey: string; childId: number; instanceId?: string }; actorHandle?: string | null }
  | { type: "ADJUST_INSTANCE_COMPLETION_QUALITY"; payload: { instanceId: string; childId: number; qualityScorePercent: number }; actorHandle?: string | null }
  | { type: "MARK_TASK_UNFINISHED"; payload: { instanceId: string; childId: number; starDelta?: number; moneyDelta?: number }; actorHandle?: string | null }
  | { type: "WAIVE_TASK_INSTANCE"; payload: { instanceId: string; reason?: string }; actorHandle?: string | null }
  | { type: "APPLY_UNDONE_PENALTY"; payload: { nowIso?: string }; actorHandle?: string | null }
  | { type: "APPLY_MISSED_CONSEQUENCES"; payload: { nowIso?: string }; actorHandle?: string | null }
  | { type: "PAY_CHILD"; payload: number }
  | { type: "START_TIMER"; payload: { timer: Timer } }
  | { type: "STOP_TIMER"; payload: { timerId: string; stoppedAt: string } }
  | { type: "ADD_PENDING_TIMED_COMPLETION"; payload: { completion: TimedCompletion } }
  | { type: "APPROVE_TIMED_COMPLETION"; payload: { completionId: string; approve: boolean; applyMoney?: boolean; qualityScorePercent?: number; actorHandle?: string | null } }
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

const MAX_TASK_INSTANCES = 2000;
const MAX_TIMED_COMPLETIONS = 500;
const MAX_ACTION_LOG = 1000;

function pruneArray<T>(items: T[] | undefined, max: number): T[] {
  if (!items || items.length <= max) return items || [];
  return items.slice(items.length - max);
}

export function pruneState(state: ChoresAppState): ChoresAppState {
  return {
    ...state,
    taskInstances: pruneArray(state.taskInstances, MAX_TASK_INSTANCES),
    timedCompletions: pruneArray(state.timedCompletions, MAX_TIMED_COMPLETIONS),
    actionLog: pruneArray(state.actionLog, MAX_ACTION_LOG),
  };
}

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

function normalizeLocalDateTimeString(value?: string): string | undefined {
  if (!value || typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Convert UTC or offset timestamps to local date-time string
  if (/Z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return getLocalDateTimeString(parsed);
    }
  }
  if (trimmed.includes("T")) {
    const [datePart, timePartRaw] = trimmed.split("T");
    if (!timePartRaw) return trimmed;
    const [hh = "00", mm = "00"] = timePartRaw.split(":");
    return `${datePart}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
  }
  return trimmed;
}

function normalizeInstanceDates(instance: TaskInstance): TaskInstance {
  const normalizedDueAt = normalizeLocalDateTimeString(instance.dueAt);
  const normalizedDueAtOverride = normalizeLocalDateTimeString(instance.dueAtOverride);
  return {
    ...instance,
    ...(normalizedDueAt ? { dueAt: normalizedDueAt } : {}),
    ...(normalizedDueAtOverride ? { dueAtOverride: normalizedDueAtOverride } : {}),
  };
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
    byWeekday: rule.byWeekday || (rule.frequency === 'weekly' ? [parseLocalDate(startDate).getDay() as Weekday] : undefined),
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
  const cronDueTime =
    baseSchedule.cronExpression && !baseSchedule.dueTime
      ? deriveDueTimeFromCron(baseSchedule.cronExpression)
      : undefined;

  return {
    ...baseSchedule,
    rule,
    timezone,
    dueTime: baseSchedule.dueTime || cronDueTime || task.recurring?.timeOfDay,
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
      : assignmentSettings.strategy === "round_robin" || task.rotation?.linkedTaskId
      ? "round-robin"
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
    // Preserve linked rotation settings and rotation order from original task
    ...(task.rotation?.linkedTaskId && { linkedTaskId: task.rotation.linkedTaskId }),
    ...(task.rotation?.linkedTaskOffset !== undefined && { linkedTaskOffset: task.rotation.linkedTaskOffset }),
    ...(task.rotation?.rotationOrder && task.rotation.rotationOrder.length > 0 && { rotationOrder: task.rotation.rotationOrder }),
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
  const normalizedDueDate = normalizeLocalDateTimeString(task.oneOff?.dueDate);
  const oneOff = task.oneOff
    ? { ...task.oneOff, ...(normalizedDueDate ? { dueDate: normalizedDueDate } : {}) }
    : undefined;

  return {
    ...task,
    assignedChildIds,
    assignment,
    rotation,
    schedule,
    consequenceRules: legacyTimedToConsequenceRules(task),
    ...(oneOff ? { oneOff } : {}),
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
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_CHILD', { child: action.payload }, action.actorHandle ?? null) ],
      };
    case "DELETE_CHILD":
      return {
        ...state,
        children: state.children.filter(child => child.id !== action.payload),
        parentSettings: {
          ...state.parentSettings,
          childDisplayOrder: (state.parentSettings.childDisplayOrder || []).filter(id => id !== action.payload),
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DELETE_CHILD', { childId: action.payload }, action.actorHandle ?? null) ],
      };
    case "UPDATE_CHILD":
      return {
        ...state,
        children: state.children.map(child => child.id === action.payload.id ? { ...child, ...action.payload } : child),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('UPDATE_CHILD', { child: action.payload }, action.actorHandle ?? null) ],
      };
    case "COMPLETE_TASK": {
      const pct = clampQualityPercent(action.payload.qualityScorePercent ?? 100);
      const applied = applyQualityMultiplier(action.payload.starReward, action.payload.moneyReward, pct);
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
                stars: child.stars + applied.stars,
                money: child.money + applied.money,
              }
            : child
        ),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('COMPLETE_TASK', { ...action.payload, ...applied, qualityScorePercent: pct }, action.actorHandle ?? null) ],
      };
    }
    case "START_TIMER": {
      const existingTimers = { ...(state.timers || {}) };
      // Remove any existing timers with the same taskKey and childId to prevent duplicates
      const timersWithSameKey = Object.values(existingTimers).filter(t => t.taskKey === action.payload.timer.taskKey && t.childId === action.payload.timer.childId);
      // Remove existing timers with the same taskKey/childId
      timersWithSameKey.forEach(t => {
        delete existingTimers[t.id];
      });
      // Add the new timer
      existingTimers[action.payload.timer.id] = action.payload.timer;
      return {
        ...state,
        timers: existingTimers,
        actionLog: [ ...(state.actionLog || []), makeLogEntry('START_TIMER', { timer: action.payload.timer }) ],
      };
    }
    case "ADD_TASK": {
      const normalizedTask = normalizeTaskPayload(action.payload);
      return {
        ...state,
        tasks: [ ...state.tasks, normalizedTask ],
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_TASK', { task: normalizedTask }, action.actorHandle ?? null) ],
      };
    }
    case "UPDATE_TASK": {
      const normalizedTask = normalizeTaskPayload(action.payload);
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === normalizedTask.id ? normalizedTask : t),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('UPDATE_TASK', { task: normalizedTask }, action.actorHandle ?? null) ],
      };
    }
    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter(t => t.id !== action.payload),
        // Also remove instances for this template
        taskInstances: state.taskInstances.filter(inst => inst.templateId !== action.payload),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DELETE_TASK', { taskId: action.payload }, action.actorHandle ?? null) ],
      };
    case "DISABLE_TASK_AFTER_DATE":
      return {
        ...state,
        tasks: state.tasks.map(t => 
          t.id === action.payload.taskId 
            ? { ...t, disabledAfter: action.payload.date }
            : t
        ),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DISABLE_TASK_AFTER_DATE', { taskId: action.payload.taskId, date: action.payload.date }, action.actorHandle ?? null) ],
      };
    case "ADD_TASK_INSTANCE":
      // Check if instance already exists to prevent duplicates
      const existingInstance = state.taskInstances.find(inst =>
        inst.id === action.payload.id ||
        (inst.templateId === action.payload.templateId &&
          inst.childId === action.payload.childId &&
          inst.date === action.payload.date)
      );
      if (existingInstance) {
        // Instance already exists, return state unchanged
        return state;
      }
      return {
        ...state,
        taskInstances: [ ...state.taskInstances, action.payload ],
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_TASK_INSTANCE', { instance: action.payload }, action.actorHandle ?? null) ],
      };
    case "REPLACE_TASK_INSTANCES": {
      const { taskId, startDate, instances, preserveCompleted } = action.payload;
      const filtered = state.taskInstances.filter(inst => {
        if (inst.templateId !== taskId) return true;
        if (preserveCompleted && inst.completed) return true;
        if (startDate) {
          return inst.date < startDate;
        }
        return false;
      });
      const merged = [...filtered];
      instances.forEach((inst) => {
        if (!merged.some(existing => existing.id === inst.id)) {
          merged.push(inst);
        }
      });
      return {
        ...state,
        taskInstances: merged,
        actionLog: [ ...(state.actionLog || []), makeLogEntry('REPLACE_TASK_INSTANCES', { taskId, startDate, added: instances.length }) ],
      };
    }
    case "UPDATE_TASK_INSTANCE":
      return {
        ...state,
        taskInstances: state.taskInstances.map(inst => inst.id === action.payload.id ? action.payload : inst),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('UPDATE_TASK_INSTANCE', { instance: action.payload }, action.actorHandle ?? null) ],
      };
    case "DELETE_TASK_INSTANCE":
      return {
        ...state,
        taskInstances: state.taskInstances.filter(inst => inst.id !== action.payload),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DELETE_TASK_INSTANCE', { instanceId: action.payload }, action.actorHandle ?? null) ],
      };
    case "COMPLETE_TASK_INSTANCE": {
      const instance = state.taskInstances.find(inst => inst.id === action.payload.instanceId);
      if (!instance) return state;
      const template = state.tasks.find(t => t.id === instance.templateId);
      const snapshotOverrides = {
        titleOverride: instance.titleOverride ?? template?.title,
        emojiOverride: instance.emojiOverride ?? template?.emoji,
        colorOverride: instance.colorOverride ?? template?.color,
        dueAtOverride: instance.dueAtOverride ?? instance.dueAt,
      };
      const pct = clampQualityPercent(action.payload.qualityScorePercent ?? 100);
      const baseStars = Number(action.payload.starReward);
      const baseMoney = Number(action.payload.moneyReward);
      const applied = applyQualityMultiplier(baseStars, baseMoney, pct);

      return {
        ...state,
        taskInstances: state.taskInstances.map(inst =>
          inst.id === action.payload.instanceId
            ? {
                ...inst,
                completed: true,
                completedAt: new Date().toISOString(),
                ...snapshotOverrides,
                completionQualityPercent: pct,
                scoreRewardBaseStars: baseStars,
                scoreRewardBaseMoney: baseMoney,
                rewardStarsApplied: applied.stars,
                rewardMoneyApplied: applied.money,
                rewardMoneySuppressed: false,
              }
            : inst
        ),
        children: state.children.map(child =>
          child.id === action.payload.childId
            ? {
                ...child,
                stars: child.stars + applied.stars,
                money: child.money + applied.money,
              }
            : child
        ),
        // Legacy: also update completedTasks for backward compatibility
        completedTasks: {
          ...state.completedTasks,
          [`${instance.childId}-${instance.templateId}-${instance.date}`]: true,
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('COMPLETE_TASK_INSTANCE', { ...action.payload, ...applied, qualityScorePercent: pct }, action.actorHandle ?? null) ],
      };
    }
    case "RESET_TASK_PROGRESS": {
      const parsed = parseTaskKey(action.payload.taskKey);
      const instance =
        (action.payload.instanceId
          ? state.taskInstances.find((inst) => inst.id === action.payload.instanceId)
          : undefined) ||
        state.taskInstances.find(
          (inst) =>
            parsed.taskId &&
            parsed.date &&
            inst.childId === action.payload.childId &&
            inst.templateId === parsed.taskId &&
            inst.date === parsed.date,
        );
      const task = instance ? state.tasks.find((t) => t.id === instance.templateId) : undefined;

      const rollbackStars = instance?.completed
        ? -Number(instance.rewardStarsApplied ?? instance.stars ?? task?.stars ?? 0)
        : 0;
      const rollbackMoney = instance?.completed
        ? -Number(instance.rewardMoneyApplied ?? instance.money ?? task?.money ?? 0)
        : 0;

      const resetTimedCompletionIds = new Set<string>();
      if (instance?.timedCompletionId) resetTimedCompletionIds.add(instance.timedCompletionId);
      (state.timedCompletions || []).forEach((c) => {
        if (c.taskKey === action.payload.taskKey && c.childId === action.payload.childId) {
          resetTimedCompletionIds.add(c.id);
        }
      });

      const timers = { ...(state.timers || {}) };
      Object.values(timers).forEach((timer) => {
        if (timer.taskKey === action.payload.taskKey && timer.childId === action.payload.childId) {
          delete timers[timer.id];
        }
      });

      const updatedInstances = state.taskInstances.map((inst) => {
        if (instance && inst.id === instance.id) {
          return {
            ...inst,
            completed: false,
            completedAt: undefined,
            timedCompletionId: undefined,
            consequenceApplied: false,
            undonePenaltyAppliedAt: undefined,
            missConsequenceAppliedAt: undefined,
            missConsequenceStarDelta: undefined,
            missConsequenceMoneyDelta: undefined,
            completionQualityPercent: undefined,
            scoreRewardBaseStars: undefined,
            scoreRewardBaseMoney: undefined,
            rewardStarsApplied: undefined,
            rewardMoneyApplied: undefined,
            rewardMoneySuppressed: undefined,
            customConsequenceLabel: undefined,
          };
        }
        return inst;
      });

      const timedCompletions = (state.timedCompletions || []).filter(
        (c) => !resetTimedCompletionIds.has(c.id),
      );

      const completedTasks = { ...state.completedTasks };
      delete completedTasks[action.payload.taskKey];
      if (instance) {
        delete completedTasks[`${instance.childId}-${instance.templateId}-${instance.date}`];
      }

      return {
        ...state,
        timers,
        timedCompletions,
        taskInstances: updatedInstances,
        completedTasks,
        children: state.children.map((child) =>
          child.id === action.payload.childId
            ? {
                ...child,
                stars: child.stars + rollbackStars,
                money: child.money + rollbackMoney,
              }
            : child,
        ),
        actionLog: [
          ...(state.actionLog || []),
          makeLogEntry(
            "RESET_TASK_PROGRESS",
            {
              ...action.payload,
              rollbackStars,
              rollbackMoney,
              clearedTimedCompletions: Array.from(resetTimedCompletionIds),
            },
            action.actorHandle ?? null,
          ),
        ],
      };
    }
    case "ADJUST_INSTANCE_COMPLETION_QUALITY": {
      const instance = state.taskInstances.find((inst) => inst.id === action.payload.instanceId);
      if (!instance || !instance.completed) return state;
      const template = state.tasks.find((t) => t.id === instance.templateId);
      const baseStars = Number(
        instance.scoreRewardBaseStars ?? instance.stars ?? template?.stars ?? 0,
      );
      const baseMoney = Number(
        instance.rewardMoneySuppressed
          ? 0
          : (instance.scoreRewardBaseMoney ?? instance.money ?? template?.money ?? 0),
      );
      const oldStars = Number(
        instance.rewardStarsApplied ??
          Math.round((baseStars * (instance.completionQualityPercent ?? 100)) / 100),
      );
      const oldMoney = Number(
        instance.rewardMoneyApplied ??
          Math.round(((baseMoney * (instance.completionQualityPercent ?? 100)) / 100) * 100) / 100,
      );
      const pct = clampQualityPercent(action.payload.qualityScorePercent);
      const next = applyQualityMultiplier(baseStars, baseMoney, pct);
      const starDelta = next.stars - oldStars;
      const moneyDelta = next.money - oldMoney;

      return {
        ...state,
        taskInstances: state.taskInstances.map((inst) =>
          inst.id === action.payload.instanceId
            ? {
                ...inst,
                completionQualityPercent: pct,
                scoreRewardBaseStars: baseStars,
                scoreRewardBaseMoney: baseMoney,
                rewardStarsApplied: next.stars,
                rewardMoneyApplied: next.money,
                rewardMoneySuppressed: Boolean(instance.rewardMoneySuppressed),
              }
            : inst,
        ),
        children: state.children.map((child) =>
          child.id === action.payload.childId
            ? {
                ...child,
                stars: child.stars + starDelta,
                money: child.money + moneyDelta,
              }
            : child,
        ),
        actionLog: [
          ...(state.actionLog || []),
          makeLogEntry(
            'ADJUST_INSTANCE_COMPLETION_QUALITY',
            { ...action.payload, starDelta, moneyDelta, next },
            action.actorHandle ?? null,
          ),
        ],
      };
    }
    case "MARK_TASK_UNFINISHED": {
      const instance = state.taskInstances.find(inst => inst.id === action.payload.instanceId);
      if (!instance || !instance.completed) return state;
      return {
        ...state,
        taskInstances: state.taskInstances.map(inst =>
          inst.id === action.payload.instanceId
            ? {
                ...inst,
                completed: false,
                completedAt: undefined,
                consequenceApplied: false,
                timedCompletionId: undefined,
              }
            : inst
        ),
        children: state.children.map(child =>
          child.id === action.payload.childId
            ? {
                ...child,
                stars: child.stars + Number(action.payload.starDelta || 0),
                money: child.money + Number(action.payload.moneyDelta || 0),
              }
            : child
        ),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('MARK_TASK_UNFINISHED', action.payload, action.actorHandle ?? null) ],
      };
    }
    case "WAIVE_TASK_INSTANCE": {
      return {
        ...state,
        taskInstances: state.taskInstances.map(inst =>
          inst.id === action.payload.instanceId
            ? {
                ...inst,
                completed: true,
                completedAt: inst.completedAt || new Date().toISOString(),
                customConsequenceLabel: action.payload.reason || "Waived by parent",
              }
            : inst
        ),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('WAIVE_TASK_INSTANCE', action.payload, action.actorHandle ?? null) ],
      };
    }
    case "APPLY_UNDONE_PENALTY": {
      const nowIso = action.payload.nowIso || new Date().toISOString();
      const today = nowIso.split("T")[0];
      const moneyByChild = new Map<number, number>();
      const updatedInstances = state.taskInstances.map((inst) => {
        if (inst.completed) return inst;
        const task = state.tasks.find(t => t.id === inst.templateId);
        if (!task) return inst;
        const rule = task.moneyPolicy?.undonePenalty;
        let penalty = applyUndonePenaltyIfDue(task, inst, nowIso);
        if (
          !penalty &&
          !inst.undonePenaltyAppliedAt &&
          rule?.enabled &&
          rule.moneyDeltaType === "absolute" &&
          typeof rule.value === "number" &&
          rule.cutoffMode === "next_due" &&
          inst.date < today
        ) {
          penalty = { starReward: 0, moneyReward: Number(rule.value) };
        }
        if (!penalty) return inst;
        moneyByChild.set(inst.childId, (moneyByChild.get(inst.childId) || 0) + penalty.moneyReward);
        return { ...inst, consequenceApplied: true, undonePenaltyAppliedAt: nowIso };
      });
      if (moneyByChild.size === 0) return state;
      return {
        ...state,
        taskInstances: updatedInstances,
        children: state.children.map((child) => {
          const delta = moneyByChild.get(child.id);
          if (!delta) return child;
          return { ...child, money: child.money + delta };
        }),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('APPLY_UNDONE_PENALTY', { nowIso, children: Object.fromEntries(moneyByChild) }, action.actorHandle ?? null) ],
      };
    }
    case "APPLY_MISSED_CONSEQUENCES": {
      const nowIso = action.payload.nowIso || new Date().toISOString();
      const now = new Date(nowIso);
      const today = nowIso.split("T")[0];
      const starsByChild = new Map<number, number>();
      const moneyByChild = new Map<number, number>();
      const updates: Array<{
        instanceId: string;
        childId: number;
        starDelta: number;
        moneyDelta: number;
        customConsequenceLabel?: string;
      }> = [];

      const updatedInstances = state.taskInstances.map((inst) => {
        if (inst.completed || inst.missConsequenceAppliedAt) return inst;
        const task = state.tasks.find((t) => t.id === inst.templateId);
        if (!task || !task.missConsequence) return inst;

        const isCarryExpired =
          inst.date < today && resolveCarryOverState(task, inst, today) === "expired_carry";
        const isOverdueExpired = getOverdueState(task, inst.date, now) === "expired";
        if (!isCarryExpired && !isOverdueExpired) return inst;

        const baseStars = Number(inst.stars ?? task.stars ?? 0);
        const baseMoney = Number(inst.money ?? task.money ?? 0);
        const out = resolveMissConsequenceOutcome(task, baseStars, baseMoney);
        if (
          Number(out.starReward || 0) === 0 &&
          Number(out.moneyReward || 0) === 0 &&
          !out.customConsequenceLabel
        ) {
          return inst;
        }

        const starDelta = Number(out.starReward || 0);
        const moneyDelta = Number(out.moneyReward || 0);
        starsByChild.set(inst.childId, (starsByChild.get(inst.childId) || 0) + starDelta);
        moneyByChild.set(inst.childId, (moneyByChild.get(inst.childId) || 0) + moneyDelta);
        updates.push({
          instanceId: inst.id,
          childId: inst.childId,
          starDelta,
          moneyDelta,
          customConsequenceLabel: out.customConsequenceLabel,
        });
        return {
          ...inst,
          missConsequenceAppliedAt: nowIso,
          missConsequenceStarDelta: starDelta,
          missConsequenceMoneyDelta: moneyDelta,
          ...(out.customConsequenceLabel
            ? { customConsequenceLabel: out.customConsequenceLabel }
            : {}),
        };
      });

      if (updates.length === 0) return state;

      return {
        ...state,
        taskInstances: updatedInstances,
        children: state.children.map((child) => {
          const starDelta = starsByChild.get(child.id) || 0;
          const moneyDelta = moneyByChild.get(child.id) || 0;
          if (starDelta === 0 && moneyDelta === 0) return child;
          return {
            ...child,
            stars: child.stars + starDelta,
            money: child.money + moneyDelta,
          };
        }),
        actionLog: [
          ...(state.actionLog || []),
          makeLogEntry("APPLY_MISSED_CONSEQUENCES", { nowIso, updates }, action.actorHandle ?? null),
        ],
      };
    }
    case "STOP_TIMER": {
      const timers = { ...(state.timers || {}) };
      const timer = timers[action.payload.timerId];
      if (!timer) {
        return state;
      }
      // compute elapsed and reward
      const started = new Date(timer.startedAt).getTime();
      const stopped = new Date(action.payload.stoppedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.round((stopped - started) / 1000));
      const allowed = timer.allowedSeconds;
      // Find task to get reward values (taskKey format: childId-taskId-date or legacy childId:choreId)
      let baseStarReward = 0;
      let baseMoneyReward = 0;
      let autoApprove = !!state.parentSettings.timedAutoApproveDefault;
      const parsedKey = parseTaskKey(timer.taskKey);
      const parsedTaskId = parsedKey.taskId;
      const parsedDate = parsedKey.date;
      let matchedTask: Task | undefined;
      
      // Try to find task from taskKey (format: childId-taskId-date or legacy childId:choreId)
      if (parsedTaskId) {
        matchedTask = state.tasks.find(t => t.id === parsedTaskId);
      } else if (parsedKey.legacyChoreId !== undefined) {
        // Legacy format: childId:choreId (for backward compatibility during migration)
        matchedTask = state.tasks.find(t => t.id === `chore_${parsedKey.legacyChoreId}`);
      }

      if (matchedTask) {
        baseStarReward = matchedTask.stars || 0;
        baseMoneyReward = matchedTask.money || 0;
        if (matchedTask.timed) {
          autoApprove = matchedTask.timed.autoApproveOnStop ?? autoApprove;
        }
      }

      const timedOutcome = matchedTask
        ? resolveTimedOutcome(matchedTask, elapsedSeconds, allowed)
        : {
            starReward: elapsedSeconds <= allowed ? baseStarReward : 0,
            moneyReward: elapsedSeconds <= allowed ? baseMoneyReward : 0,
          };
      const rewardPercentage =
        baseMoneyReward === 0 ? 1 : Number((timedOutcome.moneyReward || 0) / baseMoneyReward);
      const adjustedStars = Number(timedOutcome.starReward || 0);
      const adjustedMoney = Number(timedOutcome.moneyReward || 0);

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
      let matchedInstance = false;
      const updatedInstances = (state.taskInstances || []).map(inst => {
        if (parsedTaskId && parsedDate &&
            inst.childId === timer.childId &&
            inst.templateId === parsedTaskId &&
            inst.date === parsedDate) {
          matchedInstance = true;
          return {
            ...inst,
            completed: true,
            completedAt: action.payload.stoppedAt,
            timedCompletionId: completion.id,
            ...(matchedTask ? {
              titleOverride: inst.titleOverride ?? matchedTask.title,
              emojiOverride: inst.emojiOverride ?? matchedTask.emoji,
              colorOverride: inst.colorOverride ?? matchedTask.color,
              dueAtOverride: inst.dueAtOverride ?? inst.dueAt,
            } : {}),
          };
        }
        return inst;
      });

      if (!matchedInstance && parsedTaskId && parsedDate) {
        updatedInstances.push({
          id: `realized_${parsedTaskId}_${timer.childId}_${parsedDate}_${Date.now()}`,
          templateId: parsedTaskId,
          childId: timer.childId,
          date: parsedDate,
          completed: true,
          completedAt: action.payload.stoppedAt,
          timedCompletionId: completion.id,
          createdAt: new Date().toISOString(),
          stars: matchedTask?.stars ?? 0,
          money: matchedTask?.money ?? 0,
          titleOverride: matchedTask?.title,
          emojiOverride: matchedTask?.emoji,
          colorOverride: matchedTask?.color,
          dueAtOverride: undefined,
        });
      }

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
        const timedApplied = applyQualityMultiplier(completion.starReward, completion.moneyReward, 100);
        newState = {
          ...newState,
          children: newState.children.map(child =>
            child.id === completion.childId
              ? {
                  ...child,
                  stars: child.stars + timedApplied.stars,
                  money: +(child.money + timedApplied.money),
                }
              : child
          ),
          taskInstances: newState.taskInstances.map((inst) => {
            if (
              parsedTaskId &&
              parsedDate &&
              inst.childId === timer.childId &&
              inst.templateId === parsedTaskId &&
              inst.date === parsedDate
            ) {
              return {
                ...inst,
                completionQualityPercent: 100,
                scoreRewardBaseStars: completion.starReward,
                scoreRewardBaseMoney: completion.moneyReward,
                rewardStarsApplied: timedApplied.stars,
                rewardMoneyApplied: timedApplied.money,
                rewardMoneySuppressed: false,
              };
            }
            return inst;
          }),
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
      const completions = (state.timedCompletions || []).map((c) =>
        c.id === action.payload.completionId ? { ...c, approved: action.payload.approve } : c,
      );
      const comp = (state.timedCompletions || []).find((c) => c.id === action.payload.completionId);
      const pct = clampQualityPercent(action.payload.qualityScorePercent ?? 100);
      const applied = comp
        ? applyQualityMultiplier(comp.starReward, comp.moneyReward, pct)
        : { stars: 0, money: 0 };
      const parsedKey = comp ? parseTaskKey(comp.taskKey) : { taskId: undefined as string | undefined, date: undefined as string | undefined };
      let children = state.children;
      let taskInstances = state.taskInstances;
      if (comp && action.payload.approve) {
        const moneySuppressed = action.payload.applyMoney === false;
        const moneyAdd = moneySuppressed ? 0 : applied.money;
        children = state.children.map((child) =>
          child.id === comp.childId
            ? { ...child, stars: child.stars + applied.stars, money: +(child.money + moneyAdd) }
            : child,
        );
        if (parsedKey.taskId && parsedKey.date) {
          taskInstances = state.taskInstances.map((inst) => {
            if (
              inst.childId === comp.childId &&
              inst.templateId === parsedKey.taskId &&
              inst.date === parsedKey.date
            ) {
              return {
                ...inst,
                completionQualityPercent: pct,
                scoreRewardBaseStars: comp.starReward,
                scoreRewardBaseMoney: moneySuppressed ? 0 : comp.moneyReward,
                rewardStarsApplied: applied.stars,
                rewardMoneyApplied: moneyAdd,
                rewardMoneySuppressed: moneySuppressed,
              };
            }
            return inst;
          });
        }
      }
      return {
        ...state,
        timedCompletions: completions,
        children,
        taskInstances,
        actionLog: [
          ...(state.actionLog || []),
          makeLogEntry(
            'APPROVE_TIMED_COMPLETION',
            { completionId: action.payload.completionId, approve: action.payload.approve, qualityScorePercent: pct },
            action.payload.actorHandle ?? null,
          ),
        ],
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
      return pruneState({
        ...action.payload,
        tasks: (action.payload.tasks || []).map(normalizeTaskPayload),
        taskInstances: (action.payload.taskInstances || []).map(normalizeInstanceDates),
      });
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
  const reducerWithPrune = React.useCallback((state: ChoresAppState, action: ChoresAppAction) => {
    return pruneState(choresAppReducer(state, action));
  }, []);

  const [state, dispatch] = useReducer(reducerWithPrune, defaultState, (initial) => {
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

          const normalizedInstances = uniqueInstances.map(normalizeInstanceDates);

          return {
            ...initial,
            children: Array.isArray(parsed.children) ? (parsed.children as unknown as Child[]) : initial.children,
            tasks: normalizedTasks,
            taskInstances: normalizedInstances,
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
    const pruned = pruneState(state);
    localStorage.setItem("choresAppState", JSON.stringify(pruned));
  }, [state]);

  useEffect(() => {
    const run = () => {
      dispatch({ type: "APPLY_MISSED_CONSEQUENCES", payload: { nowIso: new Date().toISOString() } });
      dispatch({ type: "APPLY_UNDONE_PENALTY", payload: { nowIso: new Date().toISOString() } });
    };
    run();
    const id = window.setInterval(run, 60_000);
    return () => window.clearInterval(id);
  }, [dispatch]);

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
