import type Task from '@/types/task';
import { Child } from '@/components/ChoresAppContext';
import { getTheoreticalAssignment } from './projectionUtils';

export interface AssignmentContext {
  date?: string; // YYYY-MM-DD
}

export interface AssignmentPlan {
  child: Child;
  rotationIndex?: number;
}

/**
 * Legacy wrapper around projectionUtils.
 * Determines which child should be assigned to a task for a given context (date).
 */
export function assignTaskToChild(
  task: Task,
  allChildren: Child[],
  context: AssignmentContext = {},
  allTasks: Task[] = [], // Kept for signature compatibility
  visited: Set<string> | null = null // Deprecated/Ignored
): AssignmentPlan[] {
  const dateStr = context.date || new Date().toISOString().split('T')[0];
  
  // Use the new O(1) projection engine
  const assignments = getTheoreticalAssignment(task, dateStr, allTasks);
  
  // Map back to AssignmentPlan (hydrating Child objects)
  const results: AssignmentPlan[] = [];
  
  for (const assign of assignments) {
    const child = allChildren.find(c => c.id === assign.childId);
    if (child) {
      results.push({
        child,
        rotationIndex: assign.rotationIndex
      });
    }
  }
  
  return results;
}
