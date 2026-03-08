import type { ParentSettings } from "../components/ChoresAppContext";
import type { Task } from "../types/task";

export type ApprovalAction = "complete" | "earlyComplete" | "taskMove" | "editTasks" | "deleteTasks";

interface ApprovalDecisionInput {
  action: ApprovalAction;
  parentSettings: ParentSettings;
  task?: Task | null;
}

export function requiresPin({ action, parentSettings, task }: ApprovalDecisionInput): boolean {
  if (action === "complete" || action === "earlyComplete") {
    if (task?.requirePin) return true;
    return action === "earlyComplete"
      ? !!parentSettings.approvals?.earlyComplete
      : !!parentSettings.approvals?.taskComplete;
  }
  if (action === "taskMove") {
    return !!parentSettings.approvals?.taskMove;
  }
  if (action === "editTasks" || action === "deleteTasks") {
    return !!parentSettings.approvals?.editTasks;
  }
  return false;
}

export function hasApprovers(parentSettings: ParentSettings): boolean {
  return Array.isArray(parentSettings.pins) && parentSettings.pins.length > 0;
}
