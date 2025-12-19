import { Task, TaskInstance } from '../types/task';
import { parseLocalDate } from './dateUtils';

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

/**
 * Helper to compute due time for an instance
 */
export function computeDueAt(task: Task, date: string): string | undefined {
  // For one-off tasks, use the dueDate directly if it matches the date
  if (task.type === 'oneoff' && task.oneOff?.dueDate) {
    const dueDateStr = task.oneOff.dueDate.split('T')[0];
    if (dueDateStr === date) {
      return task.oneOff.dueDate;
    }
    return undefined;
  }
  
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
