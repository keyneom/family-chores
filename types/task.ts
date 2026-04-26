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

export type OverduePolicy = 'none' | 'expire' | 'open_claim' | 'grace_then_open';
export type CarryOverPolicy = 'carry_none' | 'carry_until_complete' | 'carry_with_max_days';
export type MissConsequenceType =
  | 'none'
  | 'money_penalty'
  | 'star_penalty'
  | 'reward_zero'
  | 'custom_consequence'
  /** Money and/or star penalties, optional forfeit of base reward, optional note — use when more than one lever applies. */
  | 'combined';
export type MoneyPolicyMode = 'simple' | 'tiered' | 'continuous';
export type MoneyDeltaType = 'absolute' | 'delta' | 'multiplier';
export type ConsequenceTrigger =
  | 'on_time'
  | 'late'
  | 'expired'
  | 'missed_day_rollover'
  | 'manual_parent_action'
  | 'undone_by_cutoff';

export interface MissConsequenceConfig {
  type: MissConsequenceType;
  moneyAmount?: number;
  starAmount?: number;
  customLabel?: string;
  /** When true, a miss does not grant this task’s base stars/money (can be combined with penalties). */
  zeroBaseReward?: boolean;
}

export interface MoneyTierRule {
  id: string;
  fromMinutesLate: number;
  toMinutesLate?: number;
  moneyDeltaType: MoneyDeltaType;
  value: number;
}

export interface UndonePenaltyRule {
  enabled: boolean;
  cutoffMode: 'end_of_day' | 'next_due' | 'deadline';
  cutoffAt?: string;
  moneyDeltaType?: MoneyDeltaType;
  value?: number;
}

export interface ContinuousMoneyPolicy {
  ratePerMinuteLate: number;
  minPayout?: number;
  maxPayout?: number;
  cutoffMinutes?: number;
  postCutoffFixedPayout?: number;
}

export interface MoneyPolicy {
  mode: MoneyPolicyMode;
  tiers?: MoneyTierRule[];
  continuous?: ContinuousMoneyPolicy;
  undonePenalty?: UndonePenaltyRule;
}

export interface ConsequenceRule {
  id: string;
  trigger: ConsequenceTrigger;
  moneyDeltaType?: MoneyDeltaType;
  moneyValue?: number;
  starDelta?: number;
  rewardMultiplier?: number;
  customConsequenceLabel?: string;
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
  linkedTaskOffset?: number; // integer offset when following another task's rotation
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
  overduePolicy?: OverduePolicy;
  graceMinutes?: number;
  lateRewardMode?: 'full' | 'money_forfeit' | 'scaled_penalty' | 'none';
  carryOverPolicy?: CarryOverPolicy;
  carryMaxDays?: number;
  missConsequence?: MissConsequenceConfig;
  moneyPolicy?: MoneyPolicy;
  consequenceRules?: ConsequenceRule[];
  /** Parent sets 0–100% quality when completing (or approving timed); rewards scale from base stars/money. */
  manualCompletionScore?: boolean;
  /** When true, task is shown as reminder/note and is not completable by children. */
  nonCompletable?: boolean;
}

export interface TimedSettings {
  // amount of time allowed in seconds
  allowedSeconds: number;
  // Money payout multiplier when late: 0.5 = half reward, 0 = none, -0.5 = debt.
  latePenaltyPercent?: number; // optional, defaults to 0.5 (half reward)
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
  // Per-task voice announcement settings
  // If true, this task will use voice announcements (respects global settings)
  // If false or undefined, this task will not announce (even if global is enabled)
  voiceAnnouncements?: boolean;
}

// Task Instance - represents an actual occurrence of a task that can be completed
// Instances are generated from templates (recurring/timed) or created directly (one-off)
export interface TaskInstance {
  id: string; // unique instance id
  templateId: string; // reference to the Task template (or null for standalone one-offs)
  childId: number; // assigned child
  date: string; // ISO date (YYYY-MM-DD) for this instance
  dueAt?: string; // ISO timestamp for due date/time
  // Instance-level display overrides (for edit-instance flows)
  titleOverride?: string;
  emojiOverride?: string;
  colorOverride?: string;
  dueAtOverride?: string;
  // Instance-specific overrides (optional)
  stars?: number; // override template stars
  money?: number; // override template money
  rotationIndex?: number; // which index was used in rotation assignment
  // Completion status
  completed: boolean;
  completedAt?: string; // ISO timestamp when completed
  // For timed tasks
  timedCompletionId?: string; // reference to TimedCompletion if this was a timed task
  claimedByChildId?: number;
  claimedAt?: string;
  originalAssignedChildId?: number;
  sourceDueDate?: string;
  carryDays?: number;
  consequenceApplied?: boolean;
  appliedMoneyTierId?: string;
  undonePenaltyAppliedAt?: string;
  customConsequenceLabel?: string;
  /** Parent quality score 0–100 applied to base rewards (set when using manual completion score). */
  completionQualityPercent?: number;
  /** Base stars used for quality scaling (snapshot at completion). */
  scoreRewardBaseStars?: number;
  /** Base money used for quality scaling (snapshot at completion). */
  scoreRewardBaseMoney?: number;
  /** Stars actually granted after quality multiplier. */
  rewardStarsApplied?: number;
  /** Money actually granted after quality multiplier. */
  rewardMoneyApplied?: number;
  /** True when timed completion was approved with money forgiveness. */
  rewardMoneySuppressed?: boolean;
  /** When miss consequence was applied to this instance. */
  missConsequenceAppliedAt?: string;
  /** Star delta applied by miss consequence action. */
  missConsequenceStarDelta?: number;
  /** Money delta applied by miss consequence action. */
  missConsequenceMoneyDelta?: number;
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
