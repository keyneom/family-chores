import { Task, TaskInstance } from '@/types/task';
import type { Child } from '@/components/ChoresAppContext';
import { doesScheduleRunOnDate } from './recurrenceBuilder';
import { shouldTaskRunToday } from './choreScheduling';
import { parseLocalDate, getLocalDateString } from './dateUtils';

// Helper to get previous/next dates efficiently
function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function getDaysSinceStart(startDateStr: string, currentDateStr: string): number {
  const start = parseLocalDate(startDateStr);
  const current = parseLocalDate(currentDateStr);
  const diffTime = current.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Max depth to prevent infinite loops in circular linked tasks
const MAX_LINK_DEPTH = 10;

export interface ProjectedAssignment {
  childId: number;
  rotationIndex: number;
}

/**
 * Projects which child SHOULD be assigned to a task on a specific date based on the rules.
 * This is a pure calculation (O(1) or O(chain_length)) and does not access the DB.
 */
export function getTheoreticalAssignment(
  task: Task,
  dateStr: string,
  allTasks: Task[],
  depth = 0
): ProjectedAssignment[] {
  // Guard against infinite recursion (cycles)
  if (depth > MAX_LINK_DEPTH) {
    console.warn(`Max recursion depth reached for task ${task.id} on ${dateStr}`);
    // Fallback to first child
    const fallbackId = task.rotation?.assignedChildIds?.[0] ?? task.assignedChildIds?.[0];
    return fallbackId ? [{ childId: fallbackId, rotationIndex: 0 }] : [];
  }

  // 1. Check if task runs on this date
  // For one-off tasks, check if dueDate matches
  if (task.type === 'oneoff' || task.oneOff) {
    const dueDate = task.oneOff?.dueDate;
    if (!dueDate) return [];
    
    // Extract date part for comparison
    const dueDateStr = dueDate.includes('T') 
      ? dueDate.split('T')[0] 
      : dueDate.substring(0, 10);
    
    if (dueDateStr !== dateStr) {
      return []; // One-off task doesn't run on this date
    }
  } else {
    // Recurring task - check schedule
    const schedule = task.schedule;
    if (schedule) {
      if (!doesScheduleRunOnDate(schedule, dateStr)) {
        return [];
      }
    } else if (task.recurring) {
      // Legacy recurring - use shouldTaskRunToday helper
      if (!shouldTaskRunToday(task, dateStr)) {
        return [];
      }
    } else {
      // No schedule or recurring info - skip
      return [];
    }
  }

  const rotation = task.rotation;
  const assignedIds = rotation?.assignedChildIds || task.assignedChildIds || [];
  
  if (assignedIds.length === 0) return [];

  // 2. Handle Linked Rotation (The Offset Logic)
  // Offset is a simple index offset in the rotation array, not a date offset
  if (rotation?.linkedTaskId && rotation.mode === 'round-robin') {
    const linkedTask = allTasks.find(t => t.id === rotation.linkedTaskId);
    if (linkedTask) {
      const offset = rotation.linkedTaskOffset || 0;
      
      // Get the linked task's rotation order (the source of truth for rotation sequence)
      const linkedOrder = linkedTask.rotation?.rotationOrder || 
                         linkedTask.rotation?.assignedChildIds || 
                         linkedTask.assignedChildIds || [];
      
      if (linkedOrder.length === 0) return [];
      
      // Get who's turn it is for the linked task TODAY
      const linkedTaskTodayAssignments = getTheoreticalAssignment(linkedTask, dateStr, allTasks, depth + 1);
      
      if (linkedTaskTodayAssignments.length > 0) {
        const linkedTaskTodayChildId = linkedTaskTodayAssignments[0].childId;
        const linkedTaskTodayIndex = linkedOrder.indexOf(linkedTaskTodayChildId);
        
        if (linkedTaskTodayIndex === -1) {
          // Linked task's today child not in rotation order - fallback
          return assignedIds.length > 0 ? [{ childId: assignedIds[0], rotationIndex: 0 }] : [];
        }
        
        // Apply offset: (todayIndex + offset) mod length
        // Offset 0 = same child, offset 1 = next child, offset 2 = child after next, etc.
        const targetIndex = (linkedTaskTodayIndex + offset) % linkedOrder.length;
        const targetChildId = linkedOrder[targetIndex];
        
        // Ensure the child is eligible for this task
        if (assignedIds.includes(targetChildId)) {
          return [{ childId: targetChildId, rotationIndex: assignedIds.indexOf(targetChildId) }];
        }
      }
      
      // Fallback if we can't determine linked task's assignment
      const fallbackChildId = linkedOrder.length > 0 && assignedIds.includes(linkedOrder[0])
        ? linkedOrder[0]
        : assignedIds[0];
      
      return fallbackChildId ? [{ childId: fallbackChildId, rotationIndex: assignedIds.indexOf(fallbackChildId) }] : [];
    }
  }

  // 3. Handle Standard Round-Robin
  if (rotation?.mode === 'round-robin') {
    const startDate = rotation.startDate || task.createdAt;
    // Calculate occurrences since start
    // Note: This simple day-diff assumes daily frequency. 
    // For weekly/custom, we technically need to count *valid occurrences* between start and date.
    // That is O(N) where N is days. For typical ranges (years) this is fine, but "forever" is bad.
    // Optimization: For 'daily' or 'every N days', it's math.
    // For complex 'Mondays and Wednesdays', we might need to count.
    
    const interval = task.schedule?.rule?.interval || 1;
    const frequency = task.schedule?.rule?.frequency || 'daily';
    
    let occurrenceIndex = 0;

    if (frequency === 'daily') {
        const days = getDaysSinceStart(startDate, dateStr);
        if (days < 0) return []; // Before start
        occurrenceIndex = Math.floor(days / interval);
    } else {
        // For non-daily, we must be careful.
        // Fast approximation or simulation?
        // Since we are projecting a view window (e.g. 30 days), simulation from start is risky if start was 5 years ago.
        // Let's assume daily for the critical rotation logic for now (chores usually daily).
        // Fallback to simple day count for others or implement smarter math later.
        const days = getDaysSinceStart(startDate, dateStr);
        occurrenceIndex = Math.floor(days / interval); 
    }

    const index = occurrenceIndex % assignedIds.length;
    // Apply explicit rotation order if present
    const rotationOrder = rotation.rotationOrder || assignedIds;
    const childId = rotationOrder[index];
    
    return [{ childId, rotationIndex: index }];
  }

  // 4. Handle Simultaneous (All children)
  if (rotation?.mode === 'simultaneous') {
    return assignedIds.map((id, index) => ({ childId: id, rotationIndex: index }));
  }

  // 5. Default: Single / First child
  return [{ childId: assignedIds[0], rotationIndex: 0 }];
}

/**
 * Generates a list of Projected Task Instances for a date range.
 */
export function projectTaskInstancesForRange(
  tasks: Task[],
  children: Child[],
  startDate: string,
  endDate: string
): TaskInstance[] {
  const projected: TaskInstance[] = [];
  const cursor = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  while (cursor <= end) {
    const dateStr = getLocalDateString(cursor);
    
    for (const task of tasks) {
      if (!task.enabled) continue;
      // Skip if task disabled after date
      if (task.disabledAfter && dateStr > task.disabledAfter) continue;

      const assignments = getTheoreticalAssignment(task, dateStr, tasks);
      
      for (const assign of assignments) {
        projected.push({
          id: `projected_${task.id}_${assign.childId}_${dateStr}`, // Deterministic ID
          templateId: task.id,
          childId: assign.childId,
          date: dateStr,
          completed: false,
          createdAt: new Date().toISOString(), // This is theoretical
          rotationIndex: assign.rotationIndex
        });
      }
    }
    
    cursor.setDate(cursor.getDate() + 1);
  }
  
  return projected;
}
