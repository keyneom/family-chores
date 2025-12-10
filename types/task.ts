/*
 * Unified Task model types for family-chores
 * This file defines a single Task type that can represent recurring chores,
 * one-off tasks, and timed tasks. Keep this small and explicit so the reducer
 * migration can be implemented incrementally.
 */

export type TaskType = 'recurring' | 'oneoff';

export type RotationMode = 'single-child' | 'simultaneous' | 'round-robin';
export type AssignmentStrategy = 'single' | 'simultaneous' | 'round_robin' | 'custom_sequence' | 'random';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AssignmentHistory {
  lastAssignedChildId?: number;
  lastRotationIndex?: number;
  lastAssignedDate?: string;
}

export interface TaskAssignmentSettings {
  strategy: AssignmentStrategy;
  childIds: number[];
  rotationStartDate?: string;
  history?: AssignmentHistory;
  allowSimultaneous?: boolean;
  allowMultiplePerDay?: boolean;
  groupId?: string;
  sequenceId?: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceEnd {
  type: 'never' | 'afterDate' | 'afterOccurrences';
  date?: string;
  occurrences?: number;
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // every N units
  byWeekday?: Weekday[]; // 0-6
  byMonthday?: number[]; // specific calendar days
  byMonth?: number[]; // 1-12
  bySetPosition?: number[]; // e.g., last weekday of month
  byHour?: number[];
  byMinute?: number[];
  bySecond?: number[];
  startDate?: string; // ISO date
  timeOfDay?: string; // HH:mm (24h) in local tz (legacy)
  startTime?: string; // HH:mm:ss
  timezone?: string; // IANA tz identifier
  endDate?: string; // ISO date
  count?: number; // number of occurrences
  end?: RecurrenceEnd;
  durationMinutes?: number;
  weekStart?: Weekday;
  includeDates?: string[]; // ISO dates that must run
  excludeDates?: string[]; // ISO dates to skip
}

export interface ScheduleDefinition {
  rule?: RecurrenceRule;
  cronExpression?: string; // optional advanced schedule (UTC)
  description?: string; // cached human readable summary
  dueTime?: string; // HH:mm local time
  dueWindowMinutes?: number;
  previewCount?: number;
  timezone?: string;
  includeDates?: string[];
  excludeDates?: string[];
}

export interface RotationSettings {
  mode: RotationMode;
  assignedChildIds: number[];
  rotationOrder?: number[]; // Explicit order of child IDs for rotation (e.g., [1, 3, 2] means Child1, Child3, Child2)
  lastAssignedChildId?: number;
  lastRotationIndex?: number;
  startDate?: string; // for deterministic rotations
  history?: AssignmentHistory;
  allowSimultaneous?: boolean;
  groupId?: string;
  linkedTaskId?: string; // ID of another task to link rotations with
}

export interface TaskBase {
  id: string; // stable unique id (uuid or similar)
  title: string;
  description?: string;
  assignedTo?: string; // legacy single child id
  assignedChildIds?: number[]; // multi-select list
  rotation?: RotationSettings;
  assignment?: TaskAssignmentSettings;
  stars?: number; // base star reward (can be negative)
  money?: number; // base money reward (can be negative)
  enabled?: boolean; // active/archived
  requirePin?: boolean; // per-task override for parent PIN gating
  createdAt: string; // ISO timestamp
  schedule?: ScheduleDefinition; // advanced recurrence metadata
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
  cadence?: 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'weekends' | 'custom-days';
  // for custom-days schedules, specify which days of week (0=Sunday, 1=Monday, etc.)
  customDays?: number[];
  timeOfDay?: string; // HH:mm (for legacy mapping)
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

// Task Template - defines a task that can generate instances
// Templates are stored in the tasks array and represent the definition/schema
export interface Task extends TaskBase {
  // Type helps identify what kind of template this is
  // 'recurring' = repeats on a schedule, 'oneoff' = single occurrence
  // Timed is now a property that can be set on either type
  type?: 'recurring' | 'oneoff';
  // Optional properties - a task template can have any combination
  // Timed settings can be applied to both recurring and oneoff tasks
  timed?: TimedSettings;
  recurring?: RecurringSettings;
  oneOff?: OneOffSettings;
  // Disable task after this date (ISO date string) - stops generating new instances
  disabledAfter?: string;
  // Legacy compatibility fields
  emoji?: string;
  color?: string;
}

// Task Instance - represents an actual occurrence of a task that can be completed
// Instances are generated from templates (recurring/timed) or created directly (one-off)
export interface TaskInstance {
  id: string; // unique instance id
  templateId: string; // reference to the Task template (or null for standalone one-offs)
  childId: number; // assigned child
  date: string; // ISO date (YYYY-MM-DD) for this instance
  dueAt?: string; // ISO timestamp for due date/time
  // Instance-specific overrides (optional)
  stars?: number; // override template stars
  money?: number; // override template money
  rotationIndex?: number; // which index was used in rotation assignment
  // Completion status
  completed: boolean;
  completedAt?: string; // ISO timestamp when completed
  // For timed tasks
  timedCompletionId?: string; // reference to TimedCompletion if this was a timed task
  // Metadata
  createdAt: string; // ISO timestamp when instance was created
  notes?: string; // optional notes for this instance
}

// Global slice shape for task system
export interface TasksState {
  tasks: Task[]; // Templates
  taskInstances: TaskInstance[]; // Instances
  timers: Record<string, { taskId: string; startTime: number }>;
  timedCompletions: TimedCompletion[];
}

export default Task;
