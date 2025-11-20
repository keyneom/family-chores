
/**
 * Types and context for the Family Chores app global state.
 * Provides children, chores, and parent settings, as well as a provider and hook.
 */
import React, { createContext, useContext, useEffect, useReducer, ReactNode } from "react";
import Task from "../types/task";
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
 * Represents a chore/task in the family chores app.
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
}

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
  chores: Chore[];
  // New unified tasks array (non-destructive): optional until migrated
  tasks?: Task[];
  // In-memory audit log of actions taken in the app
  actionLog?: ActionLogEntry[];
  choreTemplates: ChoreTemplate[];
  parentSettings: ParentSettings;
  completedTasks: Record<string, boolean>;
  oneOffTasks: Record<string, OneOffTask[]>;
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
  | { type: "ADD_CHORE_TEMPLATE"; payload: ChoreTemplate }
  | { type: "DELETE_CHORE_TEMPLATE"; payload: number }
  | { type: "ADD_TASK"; payload: Task }
  | { type: "UPDATE_TASK"; payload: Task }
  | { type: "COMPLETE_TASK"; payload: { taskKey: string; childId: number; starReward: number; moneyReward: number } }
  | { type: "ADD_ONE_OFF_TASK"; payload: { date: string; task: OneOffTask } }
  | { type: "PAY_CHILD"; payload: number }
  | { type: "START_TIMER"; payload: { timer: Timer } }
  | { type: "STOP_TIMER"; payload: { timerId: string; stoppedAt: string } }
  | { type: "ADD_PENDING_TIMED_COMPLETION"; payload: { completion: TimedCompletion } }
  | { type: "APPROVE_TIMED_COMPLETION"; payload: { completionId: string; approve: boolean; applyMoney?: boolean; actorHandle?: string | null } }
  | { type: "UPDATE_PARENT_SETTINGS"; payload: Partial<ParentSettings> }
  | { type: "RESET_ALL_DATA" }
  | { type: "SET_STATE"; payload: ChoresAppState };

const defaultState: ChoresAppState = {
  children: [
    { id: 1, name: "Child 1", stars: 0, money: 0 },
    { id: 2, name: "Child 2", stars: 0, money: 0 },
  ],
  chores: [
    {
      id: 1,
      name: "Washing Dishes",
      emoji: "🍽️",
      color: "#FFB6C1",
      recurrence: "daily",
      customDays: [],
      eligibleChildren: [],
      starReward: 1,
      moneyReward: 0.5,
    },
    {
      id: 2,
      name: "Sweeping Floor",
      emoji: "🧹",
      color: "#98FB98",
      recurrence: "daily",
      customDays: [],
      eligibleChildren: [],
      starReward: 1,
      moneyReward: 0.75,
    },
    {
      id: 3,
      name: "Clearing Table",
      emoji: "🪑",
      color: "#87CEEB",
      recurrence: "daily",
      customDays: [],
      eligibleChildren: [],
      starReward: 1,
      moneyReward: 0.25,
    },
    // Example timed chore
    {
      id: 4,
      name: "Quick Room Tidy",
      emoji: "🧼",
      color: "#FFD580",
      recurrence: "daily",
      customDays: [],
      eligibleChildren: [],
      starReward: 1,
      moneyReward: 0.5,
      timed: true,
      allowedSeconds: 300, // 5 minutes
      latePenaltyPercent: 0.5,
    },
  ],
  choreTemplates: [
    { id: 1, name: "Washing Dishes", emoji: "🍽️", color: "#FFB6C1", stars: 1, money: 0.5, recurrence: "daily" },
    { id: 2, name: "Sweeping Floor", emoji: "🧹", color: "#98FB98", stars: 1, money: 0.75, recurrence: "daily" },
    { id: 3, name: "Clearing Table", emoji: "🪑", color: "#87CEEB", stars: 1, money: 0.25, recurrence: "daily" },
  ],
  parentSettings: {
    // legacy single PIN removed — the app now uses named approvers in `pins`
    approvals: {
      taskMove: false,
      earlyComplete: false,
      taskComplete: false,
      editTasks: false,
    },
    timedAutoApproveDefault: false,
  },
  completedTasks: {},
  oneOffTasks: {},
  timers: {},
  timedCompletions: [],
  // start with an empty tasks array so UI can opt-in safely
  tasks: [],
  actionLog: [],
};

function makeLogEntry(actionType: string, payload?: unknown, actorHandle?: string | null): ActionLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    actionType,
    payload,
    actorHandle: actorHandle ?? null,
    timestamp: new Date().toISOString(),
  };
}

function choresAppReducer(state: ChoresAppState, action: ChoresAppAction): ChoresAppState {
  switch (action.type) {
    case "ADD_CHILD":
      return {
        ...state,
        children: [...state.children, action.payload],
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_CHILD', { child: action.payload }) ],
      };
    case "DELETE_CHILD":
      return {
        ...state,
        children: state.children.filter(child => child.id !== action.payload),
        actionLog: [ ...(state.actionLog || []), makeLogEntry('DELETE_CHILD', { childId: action.payload }) ],
      };
    case "ADD_CHORE_TEMPLATE":
      return {
        ...state,
        choreTemplates: [...state.choreTemplates, action.payload],
      };
    case "DELETE_CHORE_TEMPLATE":
      return {
        ...state,
        choreTemplates: state.choreTemplates.filter(chore => chore.id !== action.payload),
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
    case "ADD_TASK":
      return {
        ...state,
        tasks: [ ...(state.tasks || []), action.payload ],
      };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: (state.tasks || []).map(t => t.id === action.payload.id ? action.payload : t),
      };
    case "STOP_TIMER": {
      const timers = { ...(state.timers || {}) };
      const timer = timers[action.payload.timerId];
      if (!timer) return state;
      // compute elapsed and reward
      const started = new Date(timer.startedAt).getTime();
      const stopped = new Date(action.payload.stoppedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.round((stopped - started) / 1000));
      const allowed = timer.allowedSeconds;
      // find chore to get reward values if possible (taskKey format childId:choreId or one-off key)
      let baseStarReward = 0;
      let baseMoneyReward = 0;
      const [childPart, chorePart] = timer.taskKey.split(":");
      const choreId = parseInt(chorePart || "", 10);
      const chore = state.chores.find(c => c.id === choreId);
      const latePenalty = (chore && typeof chore.latePenaltyPercent === 'number') ? chore.latePenaltyPercent : 0.5;
      if (chore) {
        baseStarReward = chore.starReward;
        baseMoneyReward = chore.moneyReward;
      }
      const rewardPercentage = elapsedSeconds <= allowed ? 1 : latePenalty;
  // Stars shouldn't scale; if completed on time give full stars, otherwise no stars for late completion
  const adjustedStars = elapsedSeconds <= allowed ? baseStarReward : 0;
      const adjustedMoney = +(baseMoneyReward * rewardPercentage);

      // remove timer
      delete timers[action.payload.timerId];

      // Determine auto-approve preference (chore-level overrides parent default)
      const autoApprove = (chore && typeof chore.autoApproveOnStop === 'boolean') ? chore.autoApproveOnStop : !!state.parentSettings.timedAutoApproveDefault;

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

      let newState = {
        ...state,
        timers,
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
    case "ADD_ONE_OFF_TASK":
      // Add to legacy oneOffTasks but also create a unified Task entry for migration
      const oneOffTask: OneOffTask = action.payload.task;
      const taskEntry: Task = {
        id: `oneoff_${oneOffTask.id || Math.random().toString(36).slice(2,8)}`,
        title: oneOffTask.name || oneOffTask.name,
        description: "",
        createdAt: new Date().toISOString(),
        type: 'oneoff',
        enabled: true,
        stars: typeof oneOffTask.starReward === 'number' ? oneOffTask.starReward : 0,
        money: typeof oneOffTask.moneyReward === 'number' ? oneOffTask.moneyReward : 0,
        requirePin: false,
        oneOff: { dueDate: oneOffTask.date },
        completed: !!oneOffTask.completed,
      } as Task;

      return {
        ...state,
        oneOffTasks: {
          ...state.oneOffTasks,
          [action.payload.date]: [
            ...(state.oneOffTasks[action.payload.date] || []),
            action.payload.task,
          ],
        },
        // keep tasks array in sync (non-destructive)
        tasks: [ ...(state.tasks || []), taskEntry ],
        actionLog: [ ...(state.actionLog || []), makeLogEntry('ADD_ONE_OFF_TASK', { date: action.payload.date, task: action.payload.task }) ],
      };
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
        },
        actionLog: [ ...(state.actionLog || []), makeLogEntry('UPDATE_PARENT_SETTINGS', { updates: action.payload }) ],
      };
    case "RESET_ALL_DATA":
      return {
        ...defaultState,
        actionLog: [ ...(defaultState.actionLog || []), makeLogEntry('RESET_ALL_DATA') ],
      };
    case "SET_STATE":
      return action.payload;
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

          const mergedTasks = existingTasks.length ? existingTasks : [ ...choresToTasks, ...oneOffs ];

          return {
            ...initial,
            ...(parsed as unknown as Record<string, unknown>),
            // prefer existing completed/oneOff keys, but ensure they're objects
            completedTasks: (parsed.completedTasks && typeof parsed.completedTasks === 'object') ? (parsed.completedTasks as unknown as Record<string, boolean>) : {},
            oneOffTasks: (parsed.oneOffTasks && typeof parsed.oneOffTasks === 'object') ? (parsed.oneOffTasks as unknown as Record<string, OneOffTask[]>) : ({} as Record<string, OneOffTask[]>),
            // populate the new tasks array without deleting legacy fields
            tasks: mergedTasks,
            // Use parsed parentSettings if present; do not auto-migrate legacy PINs into approvers.
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
