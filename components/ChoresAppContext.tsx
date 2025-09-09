
/**
 * Types and context for the Family Chores app global state.
 * Provides children, chores, and parent settings, as well as a provider and hook.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

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

export interface ParentSettings {
  pin: string;
  approvals: {
    taskMove: boolean;
    earlyComplete: boolean;
    taskComplete: boolean;
    editTasks: boolean;
  };
}

export interface ChoresAppState {
  children: Child[];
  chores: Chore[];
  parentSettings: ParentSettings;
}

const defaultState: ChoresAppState = {
  children: [
    { id: 1, name: "Child 1", stars: 0, money: 0 },
    { id: 2, name: "Child 2", stars: 0, money: 0 },
    { id: 3, name: "Child 3", stars: 0, money: 0 },
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
  parentSettings: {
    pin: "",
    approvals: {
      taskMove: false,
      earlyComplete: false,
      taskComplete: false,
      editTasks: false,
    },
  },
};

interface ChoresAppContextType {
  state: ChoresAppState;
  setState: React.Dispatch<React.SetStateAction<ChoresAppState>>;
}

const ChoresAppContext = createContext<ChoresAppContextType | undefined>(undefined);

export function ChoresAppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChoresAppState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("choresAppState");
      if (saved) return JSON.parse(saved);
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem("choresAppState", JSON.stringify(state));
  }, [state]);

  return (
    <ChoresAppContext.Provider value={{ state, setState }}>
      {children}
    </ChoresAppContext.Provider>
  );
}

export function useChoresApp() {
  const context = useContext(ChoresAppContext);
  if (!context) throw new Error("useChoresApp must be used within ChoresAppProvider");
  return context;
}
