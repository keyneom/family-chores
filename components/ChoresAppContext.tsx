
/**
 * Types and context for the Family Chores app global state.
 * Provides children, chores, and parent settings, as well as a provider and hook.
 */
import React, { createContext, useContext, useEffect, useReducer, ReactNode } from "react";

/**
 * Represents a child in the family chores app.
 */
export interface Child {
  id: number;
  name: string;
  stars: number;
  money: number;
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
  pin: string;
  approvals: {
    taskMove: boolean;
    earlyComplete: boolean;
    taskComplete: boolean;
    editTasks: boolean;
  };
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
}

export interface ChoresAppState {
  children: Child[];
  chores: Chore[];
  choreTemplates: ChoreTemplate[];
  parentSettings: ParentSettings;
  completedTasks: Record<string, boolean>;
  oneOffTasks: Record<string, OneOffTask[]>;
}

type ChoresAppAction =
  | { type: "ADD_CHILD"; payload: Child }
  | { type: "DELETE_CHILD"; payload: number }
  | { type: "ADD_CHORE_TEMPLATE"; payload: ChoreTemplate }
  | { type: "DELETE_CHORE_TEMPLATE"; payload: number }
  | { type: "COMPLETE_TASK"; payload: { taskKey: string; childId: number; starReward: number; moneyReward: number } }
  | { type: "ADD_ONE_OFF_TASK"; payload: { date: string; task: OneOffTask } }
  | { type: "PAY_CHILD"; payload: number }
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
  ],
  choreTemplates: [
    { id: 1, name: "Washing Dishes", emoji: "🍽️", color: "#FFB6C1", stars: 1, money: 0.5, recurrence: "daily" },
    { id: 2, name: "Sweeping Floor", emoji: "🧹", color: "#98FB98", stars: 1, money: 0.75, recurrence: "daily" },
    { id: 3, name: "Clearing Table", emoji: "🪑", color: "#87CEEB", stars: 1, money: 0.25, recurrence: "daily" },
  ],
  parentSettings: {
    pin: "",
    approvals: {
      taskMove: false,
      earlyComplete: false,
      taskComplete: false,
      editTasks: false,
    },
  },
  completedTasks: {},
  oneOffTasks: {},
};

function choresAppReducer(state: ChoresAppState, action: ChoresAppAction): ChoresAppState {
  switch (action.type) {
    case "ADD_CHILD":
      return {
        ...state,
        children: [...state.children, action.payload],
      };
    case "DELETE_CHILD":
      return {
        ...state,
        children: state.children.filter(child => child.id !== action.payload),
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
      };
    case "ADD_ONE_OFF_TASK":
      return {
        ...state,
        oneOffTasks: {
          ...state.oneOffTasks,
          [action.payload.date]: [
            ...(state.oneOffTasks[action.payload.date] || []),
            action.payload.task,
          ],
        },
      };
    case "PAY_CHILD":
      return {
        ...state,
        children: state.children.map(child =>
          child.id === action.payload
            ? { ...child, money: 0 }
            : child
        ),
      };
    case "UPDATE_PARENT_SETTINGS":
      return {
        ...state,
        parentSettings: {
          ...state.parentSettings,
          ...action.payload,
        },
      };
    case "RESET_ALL_DATA":
      return defaultState;
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
          const parsed = JSON.parse(saved);
          return {
            ...initial,
            ...parsed,
            completedTasks: parsed.completedTasks || {},
            oneOffTasks: parsed.oneOffTasks || {},
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
