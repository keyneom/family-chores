import { Task } from '@/types/task';
import { doesScheduleRunOnDate, describeSchedule } from './recurrenceBuilder';

export function shouldTaskRunToday(task: Task, date?: string): boolean {
  if (task.schedule) {
    return doesScheduleRunOnDate(task.schedule, date ?? new Date().toISOString().split('T')[0]);
  }

  // Only check recurring tasks
  if (!task.recurring) return false;
  
  const targetDate = date ? new Date(date) : new Date();
  const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const cadence = task.recurring.cadence || 'daily';
  
  switch (cadence) {
    case 'daily':
      return true;
    case 'weekly':
      // Run once per week, on the same day based on task id hash
      const taskIdHash = parseInt(task.id.replace(/\D/g, '')) || 0;
      return dayOfWeek === (taskIdHash % 7);
    case 'monthly':
      // Run on the first occurrence of the task's assigned day each month
      const firstOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const taskIdHash2 = parseInt(task.id.replace(/\D/g, '')) || 0;
      const targetDay = (taskIdHash2 % 7);
      let firstTargetDay = new Date(firstOfMonth);
      firstTargetDay.setDate(firstTargetDay.getDate() + (targetDay - firstTargetDay.getDay() + 7) % 7);
      return targetDate.getDate() === firstTargetDay.getDate();
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    case 'custom-days':
      return task.recurring.customDays?.includes(dayOfWeek) || false;
    default:
      return true;
  }
}


// Legacy compatibility functions (for backward compatibility during migration)
import { Chore } from '@/components/ChoresAppContext';

export function shouldChoreRunToday(chore: Chore): boolean {
  // Convert Chore to Task-like structure for compatibility
  const task: Task = {
    id: String(chore.id),
    title: chore.name,
    emoji: chore.emoji,
    color: chore.color,
    stars: chore.starReward,
    money: chore.moneyReward,
    type: 'recurring',
    enabled: true,
    createdAt: new Date().toISOString(),
    description: '',
    requirePin: false,
    recurring: {
      cadence: (chore.recurrence === 'weekdays' ? 'weekdays' :
               chore.recurrence === 'weekends' ? 'weekends' :
               chore.recurrence === 'custom-days' ? 'custom-days' :
               chore.recurrence === 'weekly' ? 'weekly' :
               chore.recurrence === 'monthly' ? 'monthly' : 'daily') as 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'weekends' | 'custom-days',
      customDays: chore.recurrence === 'custom-days' ? chore.customDays : undefined
    }
  };
  return shouldTaskRunToday(task);
}

// Legacy compatibility: getRecurrenceDescription for Chore type (used by tests)
export function getRecurrenceDescription(chore: Chore): string {
  // Convert Chore to Task-like structure for compatibility
  const task: Task = {
    id: String(chore.id),
    title: chore.name,
    emoji: chore.emoji,
    color: chore.color,
    stars: chore.starReward,
    money: chore.moneyReward,
    type: 'recurring',
    enabled: true,
    createdAt: new Date().toISOString(),
    description: '',
    requirePin: false,
    recurring: {
      cadence: (chore.recurrence === 'weekdays' ? 'weekdays' :
               chore.recurrence === 'weekends' ? 'weekends' :
               chore.recurrence === 'custom-days' ? 'custom-days' :
               chore.recurrence === 'weekly' ? 'weekly' :
               chore.recurrence === 'monthly' ? 'monthly' : 'daily') as 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'weekends' | 'custom-days',
      customDays: chore.recurrence === 'custom-days' ? chore.customDays : undefined
    }
  };
  return getRecurrenceDescriptionForTask(task);
}

// New function name for Task type (to avoid naming conflict)
export function getRecurrenceDescriptionForTask(task: Task): string {
  if (task.schedule) return describeSchedule(task.schedule);
  if (!task.recurring) return 'Not recurring';
  
  const cadence = task.recurring.cadence || 'daily';
  switch (cadence) {
    case 'daily':
      return 'Every day';
    case 'weekly':
      const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const taskIdHash = parseInt(task.id.replace(/\D/g, '')) || 0;
      return `Weekly on ${weekDays[taskIdHash % 7]}`;
    case 'monthly':
      return 'Monthly (first occurrence)';
    case 'weekdays':
      return 'Weekdays only';
    case 'weekends':
      return 'Weekends only';
    case 'custom-days':
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const selectedDays = (task.recurring.customDays || []).map(d => dayNames[d]);
      return selectedDays.length > 0 ? selectedDays.join(', ') : 'No days selected';
    default:
      return 'Daily';
  }
}