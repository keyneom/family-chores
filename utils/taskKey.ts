export interface ParsedTaskKey {
  childId?: number;
  taskId?: string;
  date?: string;
  legacyChoreId?: number;
}

export function buildTaskKey(childId: number, taskId: string, date: string): string {
  const datePart = date.includes("T") ? date.split("T")[0] : date;
  return `${childId}-${taskId}-${datePart}`;
}

export function parseTaskKey(taskKey: string): ParsedTaskKey {
  if (!taskKey) return {};

  if (taskKey.includes(':')) {
    const [childPart, chorePart] = taskKey.split(':');
    const childId = Number(childPart);
    const legacyChoreId = Number(chorePart);
    return {
      childId: Number.isFinite(childId) ? childId : undefined,
      legacyChoreId: Number.isFinite(legacyChoreId) ? legacyChoreId : undefined,
    };
  }

  const parts = taskKey.split('-');
  if (parts.length < 2) return {};

  const childId = Number(parts[0]);
  if (parts.length >= 5) {
    const date = parts.slice(-3).join('-');
    const taskId = parts.slice(1, -3).join('-');
    return {
      childId: Number.isFinite(childId) ? childId : undefined,
      taskId: taskId || undefined,
      date,
    };
  }

  const taskId = parts.slice(1).join('-');
  return {
    childId: Number.isFinite(childId) ? childId : undefined,
    taskId: taskId || undefined,
  };
}
