import { ScheduleDefinition, RecurrenceRule, Weekday } from '@/types/task';

interface CronField {
  any?: boolean;
  values?: number[];
  step?: number;
}

interface CronParts {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function doesScheduleRunOnDate(schedule: ScheduleDefinition, date: string): boolean {
  if (schedule.includeDates?.includes(date)) return true;
  if (schedule.excludeDates?.includes(date)) return false;
  if (schedule.cronExpression) {
    const cron = parseCronExpression(schedule.cronExpression);
    const targetDate = new Date(`${date}T00:00:00`);
    return cronMatchesDate(cron, targetDate);
  }

  if (schedule.rule) {
    return ruleMatchesDate(schedule.rule, date);
  }

  return false;
}

export function getNextOccurrences(schedule: ScheduleDefinition, startDate: string, count = 5): string[] {
  const occurrences: string[] = [];
  let cursor = new Date(`${startDate}T00:00:00`);
  let attempts = 0;
  const maxAttempts = 365; // safeguard

  while (occurrences.length < count && attempts < maxAttempts) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (doesScheduleRunOnDate(schedule, dateStr)) {
      occurrences.push(dateStr);
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
    attempts++;
  }

  return occurrences;
}

export function getNextExecutionDateTimes(schedule: ScheduleDefinition, startDate: string, count = 5): string[] {
  const dates = getNextOccurrences(schedule, startDate, count);
  const timeOfDay = schedule.dueTime || schedule.rule?.startTime || schedule.rule?.timeOfDay;
  return dates.map((date) => combineDateAndTime(date, timeOfDay));
}

export function buildCronExpressionFromRule(rule: RecurrenceRule): string | undefined {
  const interval = Math.max(1, rule.interval ?? 1);
  const [hourStr = '0', minuteStr = '0'] = (rule.startTime || rule.timeOfDay || '00:00').split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return undefined;

  switch (rule.frequency) {
    case 'daily':
      return `${minute} ${hour} */${interval} * *`;
    case 'weekly': {
      const dow = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday.join(',') : '*';
      return `${minute} ${hour} * * ${dow}`;
    }
    case 'monthly': {
      const dom = rule.byMonthday && rule.byMonthday.length > 0 ? rule.byMonthday.join(',') : '1';
      return `${minute} ${hour} ${dom} */${interval} *`;
    }
    case 'yearly':
    default:
      return `${minute} ${hour} 1 1 *`;
  }
}

export function describeSchedule(schedule: ScheduleDefinition): string {
  if (schedule.description) return schedule.description;
  if (schedule.cronExpression) return `Cron: ${schedule.cronExpression}`;
  if (!schedule.rule) return 'No schedule';

  const { frequency, interval, byWeekday, byMonthday } = schedule.rule;
  const everyText = interval && interval > 1 ? `Every ${interval}` : 'Every';
  const timeLabel = formatTimeLabel(schedule.dueTime || schedule.rule.startTime || schedule.rule.timeOfDay);
  const timeSuffix = timeLabel ? ` at ${timeLabel}` : '';
  const timezoneSuffix = schedule.timezone ? ` (${schedule.timezone})` : '';

  switch (frequency) {
    case 'daily':
      return `${everyText} day${timeSuffix}${timezoneSuffix}`;
    case 'weekly': {
      if (byWeekday && byWeekday.length > 0) {
        const names = byWeekday.map((d) => WEEKDAY_NAMES[d % 7]).join(', ');
        return `${everyText} week on ${names}${timeSuffix}${timezoneSuffix}`;
      }
      return `${everyText} week${timeSuffix}${timezoneSuffix}`;
    }
    case 'monthly': {
      if (byMonthday && byMonthday.length > 0) {
        const days = byMonthday.join(', ');
        return `${everyText} month on day(s) ${days}${timeSuffix}${timezoneSuffix}`;
      }
      return `${everyText} month${timeSuffix}${timezoneSuffix}`;
    }
    case 'yearly':
    default:
      return `${everyText} year${timeSuffix}${timezoneSuffix}`;
  }
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTimeLabel(time?: string): string | null {
  if (!time) return null;
  const [hourStr, minuteStr = '0'] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return time;
  const sample = new Date();
  sample.setHours(hour, minute, 0, 0);
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    return Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(sample);
  }
  return `${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}`;
}

function ruleMatchesDate(rule: RecurrenceRule, date: string): boolean {
  const targetDate = new Date(`${date}T00:00:00`);
  const startDate = rule.startDate ? new Date(rule.startDate) : undefined;
  if (rule.includeDates?.includes(date)) return true;
  if (rule.excludeDates?.includes(date)) return false;
  if (startDate && targetDate < startDate) return false;
  const endBoundary = (rule.end?.type === 'afterDate' ? rule.end.date : undefined) || rule.endDate;
  if (endBoundary && targetDate > new Date(endBoundary)) return false;

  const interval = rule.interval ?? 1;
  let occurrenceIndex: number | undefined;

  switch (rule.frequency) {
    case 'weekly': {
      if (!matchesWeekday(rule, targetDate)) return false;
      const diffWeeks = Math.floor(diffInDays(startDate || targetDate, targetDate) / 7);
      if (diffWeeks % interval !== 0) return false;
      occurrenceIndex = Math.floor(diffWeeks / interval);
      break;
    }
    case 'monthly': {
      if (!matchesMonthday(rule, targetDate)) return false;
      const diffMonths = diffInMonths(startDate || targetDate, targetDate);
      if (diffMonths % interval !== 0) return false;
      occurrenceIndex = Math.floor(diffMonths / interval);
      break;
    }
    case 'yearly': {
      const diffYears = targetDate.getFullYear() - (startDate?.getFullYear() ?? targetDate.getFullYear());
      if (diffYears % interval !== 0) return false;
      occurrenceIndex = Math.floor(diffYears / interval);
      break;
    }
    case 'daily':
    default: {
      const diffDays = diffInDays(startDate || targetDate, targetDate);
      if (diffDays % interval !== 0) return false;
      occurrenceIndex = Math.floor(diffDays / interval);
      break;
    }
  }

  if (rule.end?.type === 'afterOccurrences' && typeof rule.end.occurrences === 'number' && typeof occurrenceIndex === 'number') {
    return occurrenceIndex < rule.end.occurrences;
  }

  return true;
}

function matchesWeekday(rule: RecurrenceRule, date: Date): boolean {
  if (!rule.byWeekday || rule.byWeekday.length === 0) return true;
  const day = date.getDay() as Weekday;
  return rule.byWeekday.includes(day);
}

function matchesMonthday(rule: RecurrenceRule, date: Date): boolean {
  if (rule.byMonthday && rule.byMonthday.length > 0) {
    return rule.byMonthday.includes(date.getDate());
  }

  if (rule.bySetPosition && rule.byWeekday && rule.byWeekday.length > 0) {
    const day = date.getDay() as Weekday;
    if (!rule.byWeekday.includes(day)) return false;

    const positions = rule.bySetPosition;
    const weekOfMonth = Math.ceil(date.getDate() / 7);
    if (positions.includes(weekOfMonth)) return true;

    if (positions.includes(-1)) {
      const lastWeekday = getLastWeekdayOfMonth(date, day);
      return date.getDate() === lastWeekday;
    }
  }

  return true;
}

function getLastWeekdayOfMonth(date: Date, weekday: number): number {
  const temp = new Date(date.getFullYear(), date.getMonth() + 1, 0); // last day of month
  while (temp.getDay() !== weekday) {
    temp.setDate(temp.getDate() - 1);
  }
  return temp.getDate();
}

function diffInDays(start: Date, end: Date): number {
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endMidnight.getTime() - startMidnight.getTime()) / DAY_MS);
}

function diffInMonths(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function combineDateAndTime(date: string, time?: string): string {
  const base = new Date(`${date}T00:00:00`);
  if (!time) return base.toISOString();
  const [hourStr, minuteStr = '0', secondStr = '0'] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);
  base.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, Number.isFinite(second) ? second : 0, 0);
  return base.toISOString();
}

function parseCronExpression(expr: string): CronParts {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expr.trim().split(/\s+/);
  if ([minute, hour, dayOfMonth, month, dayOfWeek].some((field) => typeof field === 'undefined')) {
    throw new Error(`Invalid cron expression: ${expr}`);
  }
  return {
    minute: parseCronField(minute),
    hour: parseCronField(hour),
    dayOfMonth: parseCronField(dayOfMonth),
    month: parseCronField(month),
    dayOfWeek: parseCronField(dayOfWeek),
  };
}

function parseCronField(token: string): CronField {
  if (token === '*') return { any: true };
  if (token.startsWith('*/')) {
    const step = parseInt(token.slice(2), 10);
    return { step: isNaN(step) ? 1 : step };
  }
  const values = token.split(',').map((value) => parseInt(value, 10)).filter((value) => !isNaN(value));
  return { values };
}

function cronMatchesDate(parts: CronParts, date: Date): boolean {
  const minuteMatch = fieldMatches(parts.minute, date.getMinutes());
  const hourMatch = fieldMatches(parts.hour, date.getHours());
  const domMatch = fieldMatches(parts.dayOfMonth, date.getDate());
  const monthMatch = fieldMatches(parts.month, date.getMonth() + 1);
  const dowMatch = fieldMatches(parts.dayOfWeek, date.getDay());

  // Cron semantics treat day-of-month and day-of-week as OR when both are restricted.
  const dayMatches =
    (parts.dayOfMonth.any || (parts.dayOfMonth.values && parts.dayOfMonth.values.length === 0))
      ? dowMatch
      : (parts.dayOfWeek.any || (parts.dayOfWeek.values && parts.dayOfWeek.values.length === 0))
        ? domMatch
        : (domMatch || dowMatch);

  return minuteMatch && hourMatch && monthMatch && dayMatches;
}

function fieldMatches(field: CronField, value: number): boolean {
  if (field.any) return true;
  if (typeof field.step === 'number') {
    return value % field.step === 0;
  }
  if (field.values && field.values.length > 0) {
    return field.values.includes(value);
  }
  // default if no rule - allow
  return true;
}


