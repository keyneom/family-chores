/*
 * Unified Task model types for family-chores
 * This file defines a single Task type that can represent recurring chores,
 * one-off tasks, and timed tasks. Keep this small and explicit so the reducer
 * migration can be implemented incrementally.
 */

export type TaskType = 'recurring' | 'oneoff' | 'timed';

export interface TaskBase {
  id: string; // stable unique id (uuid or similar)
  title: string;
  description?: string;
  assignedTo?: string; // child id
  stars?: number; // base star reward (can be negative)
  money?: number; // base money reward (can be negative)
  enabled?: boolean; // active/archived
  requirePin?: boolean; // per-task override for parent PIN gating
  createdAt: string; // ISO timestamp
  tags?: string[];
}

export interface TimedSettings {
  // amount of time allowed in seconds
  allowedSeconds: number;
  // percent to apply when late (e.g. 50 for 50% when late). Negative allowed for penalties.
  latePenaltyPercent?: number; // optional, defaults to 0 (no reward)
  // whether stopping the timer auto-approves the completion (overrides parent default)
  autoApproveOnStop?: boolean;
  // allow negative money results from timed completion flows
  allowNegative?: boolean;
}

export interface RecurringSettings {
  cadence?: 'daily' | 'weekly' | 'monthly' | 'custom';
  // for custom schedules you may add recurrence rules here later
  // keep intentionally minimal for now
}

export interface OneOffSettings {
  dueDate?: string; // ISO date
}

export interface TimedCompletion {
  id: string;
  // a stable key that identifies the task instance for a specific child/day
  taskKey: string;
  // numeric child id (keeps parity with legacy state)
  childId: number;
  // ISO timestamps for start/stop
  startedAt: string;
  stoppedAt?: string;
  // allowed time in seconds for the task
  allowedSeconds: number;
  // computed when stopped
  elapsedSeconds: number;
  // fraction used to compute money adjustments (1 = 100% on time, 0.5 = 50%)
  rewardPercentage: number;
  // awarded stars (integer, can be 0)
  starReward: number;
  // task-level auto-approve flag if present
  autoApproveOnStop?: boolean;
  // monetary reward (can be negative)
  moneyReward: number;
  // approved by parent (if required)
  approved?: boolean;
  // ISO timestamp when completion record was created
  createdAt: string;
}

export interface TaskTimed extends TaskBase {
  type: 'timed';
  timed: TimedSettings;
}

export interface TaskRecurring extends TaskBase {
  type: 'recurring';
  recurring?: RecurringSettings;
}

export interface TaskOneOff extends TaskBase {
  type: 'oneoff';
  oneOff?: OneOffSettings;
  completed?: boolean;
}

export type Task = TaskTimed | TaskRecurring | TaskOneOff;

// Global slice shape (suggested). We won't swap the reducer in this patch
// — this is the contract to guide the upcoming migration/refactor.
export interface TasksState {
  tasks: Task[];
  timers: Record<string, { taskId: string; startTime: number }>;
  timedCompletions: TimedCompletion[];
}

export default Task;
