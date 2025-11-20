import React from "react";

export const ModalControlContext = React.createContext<{
  openTaskEditModal: (taskId: string | number) => void;
  openAddTaskModal: (childId: number) => void;
  openEditChildModal: (childId: number) => void;
  openAddChildModal: () => void;
  openAddChoreModal: () => void;
  openEditChoreModal: (choreId: number) => void;
  openOneOffTaskModal: (childId: number) => void;
} | undefined>(undefined);

export function useModalControl() {
  const ctx = React.useContext(ModalControlContext);
  if (!ctx) throw new Error("useModalControl must be used within ModalControlContext.Provider");
  return ctx;
}
