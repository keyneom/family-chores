import { Task, TaskInstance, RotationSettings, TaskAssignmentSettings } from '../types/task';
import { Child } from '../components/ChoresAppContext';
import { assignTaskToChild } from './taskAssignment';
import { shouldTaskRunToday } from './choreScheduling';
import { parseLocalDate } from './dateUtils';

/**
 * Generate task instances from templates for a given date.
 * For recurring/timed tasks, instances are auto-generated based on schedule.
 * For one-off tasks, instances are created when the task is added.
 */
export interface RotationUpdateState {
  rotation: RotationSettings;
  assignment?: TaskAssignmentSettings;
}

export interface GenerationResult {
  instances: TaskInstance[];
  rotationStates: { taskId: string; rotation: RotationSettings; assignment?: TaskAssignmentSettings }[];
}

export function generateInstancesForDate(
  templates: Task[],
  children: Child[],
  date: string, // ISO date (YYYY-MM-DD)
  existingInstances: TaskInstance[]
): GenerationResult {
  const instances: TaskInstance[] = [];
  const rotationUpdates: Record<string, RotationUpdateState> = {};
  const dateStr = date.split('T')[0]; // Ensure we only use the date part

  templates.forEach((template) => {
    // Skip disabled templates
    if (template.enabled === false) return;
    
    // Skip templates that are disabled after this date
    if (template.disabledAfter && dateStr > template.disabledAfter) return;

    const assignments = assignTaskToChild(template, children, { date: dateStr });
    if (!assignments || assignments.length === 0) return;

    const shouldRun = evaluateShouldRun(template, dateStr);
    if (!shouldRun) return;

    assignments.forEach(({ child, rotationIndex }) => {
      const exists = existingInstances.some(
        (inst) => inst.templateId === template.id && inst.date === dateStr && inst.childId === child.id
      );
      if (exists) return;

      const dueAt = computeDueAt(template, dateStr);
      instances.push({
        id: `instance_${template.id}_${child.id}_${dateStr}`,
        templateId: template.id,
        childId: child.id,
        date: dateStr,
        dueAt,
        stars: template.stars,
        money: template.money,
        rotationIndex,
        completed: false,
        createdAt: new Date().toISOString(),
      });

      if (typeof rotationIndex === 'number') {
        const assignment = template.assignment;
        const assignedIds =
          assignment?.childIds ||
          template.rotation?.assignedChildIds ||
          template.assignedChildIds ||
          [child.id];

        const history = {
          ...(assignment?.history || template.rotation?.history || {}),
          lastRotationIndex: rotationIndex,
          lastAssignedChildId: child.id,
          lastAssignedDate: dateStr,
        };

        rotationUpdates[template.id] = {
          rotation: {
            mode: template.rotation?.mode ?? 'round-robin',
            assignedChildIds: assignedIds,
            lastRotationIndex: rotationIndex,
            lastAssignedChildId: child.id,
            startDate: template.rotation?.startDate ?? assignment?.rotationStartDate ?? template.createdAt,
            history,
            allowSimultaneous: template.rotation?.allowSimultaneous ?? assignment?.allowSimultaneous,
            groupId: template.rotation?.groupId ?? assignment?.groupId,
          },
          assignment: assignment
            ? {
                ...assignment,
                childIds: assignedIds,
                rotationStartDate: assignment.rotationStartDate ?? template.rotation?.startDate ?? template.createdAt,
                history,
              }
            : undefined,
        };
      }
    });
    // One-off tasks are created directly as instances, not generated from templates
  });

  const rotationStates = Object.entries(rotationUpdates).map(([taskId, state]) => ({
    taskId,
    rotation: state.rotation,
    assignment: state.assignment,
  }));

  return { instances, rotationStates };
}

/**
 * Get all instances for a specific child on a specific date
 */
export function getInstancesForChildAndDate(
  instances: TaskInstance[],
  childId: number,
  date: string
): TaskInstance[] {
  const dateStr = date.split('T')[0];
  return instances.filter(
    (inst) => inst.childId === childId && inst.date === dateStr
  );
}

/**
 * Get the template for a given instance
 */
export function getTemplateForInstance(
  instance: TaskInstance,
  templates: Task[]
): Task | undefined {
  return templates.find((t) => t.id === instance.templateId);
}

/**
 * Create a standalone one-off task instance (no template)
 */
export function createOneOffInstance(
  task: Task,
  childId: number,
  date: string
): TaskInstance {
  const dateStr = date.split('T')[0];
  return {
    id: `oneoff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    templateId: task.id, // Reference to template if created from one, or same as id for standalone
    childId,
    date: dateStr,
    stars: task.stars,
    money: task.money,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

function computeDueAt(task: Task, date: string): string | undefined {
  const timeOfDay =
    task.schedule?.dueTime ||
    task.schedule?.rule?.startTime ||
    task.schedule?.rule?.timeOfDay ||
    task.recurring?.timeOfDay;
  if (!timeOfDay) return undefined;
  const [hours, minutes] = timeOfDay.split(':').map((value) => parseInt(value, 10));
  if (isNaN(hours) || isNaN(minutes)) return undefined;
  // Use parseLocalDate to avoid timezone conversion issues
  const localDate = parseLocalDate(date);
  localDate.setHours(hours, minutes, 0, 0);
  return localDate.toISOString();
}

function evaluateShouldRun(task: Task, date: string): boolean {
  if (task.schedule) {
    return shouldTaskRunToday(task, date);
  }

  if (task.type === 'oneoff') {
    return task.oneOff?.dueDate?.split('T')[0] === date;
  }

  if (task.recurring || task.type === 'recurring') {
    return shouldTaskRunToday(task, date);
  }

  if (task.timed) {
    if (task.recurring) {
      return shouldTaskRunToday(task, date);
    }
    return true;
  }

  return false;
}

