import { Chore } from '@/components/ChoresAppContext';

export function shouldChoreRunToday(chore: Chore): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  switch (chore.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      // Run once per week, on the same day as the chore was created
      return dayOfWeek === (chore.id % 7);
    case 'monthly':
      // Run on the first occurrence of the chore's assigned day each month
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const targetDay = (chore.id % 7);
      let firstTargetDay = new Date(firstOfMonth);
      firstTargetDay.setDate(firstTargetDay.getDate() + (targetDay - firstTargetDay.getDay() + 7) % 7);
      return today.getDate() === firstTargetDay.getDate();
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    case 'custom-days':
      return chore.customDays.includes(dayOfWeek);
    default:
      return true;
  }
}

export function getRecurrenceDescription(chore: Chore): string {
  switch (chore.recurrence) {
    case 'daily':
      return 'Every day';
    case 'weekly':
      const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Weekly on ${weekDays[chore.id % 7]}`;
    case 'monthly':
      return 'Monthly (first occurrence)';
    case 'weekdays':
      return 'Weekdays only';
    case 'weekends':
      return 'Weekends only';
    case 'custom-days':
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const selectedDays = chore.customDays.map(d => dayNames[d]);
      return selectedDays.length > 0 ? selectedDays.join(', ') : 'No days selected';
    default:
      return 'Daily';
  }
}