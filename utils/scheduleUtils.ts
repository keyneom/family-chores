import type { Task, ScheduleDefinition, RecurrenceRule, Weekday } from "../types/task";
import { deriveDueTimeFromCron } from "./recurrenceBuilder";

function getDefaultTimezone(): string | undefined {
  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || undefined;
  }
  return undefined;
}

function scheduleFromRecurring(task: Task): ScheduleDefinition | undefined {
  const recurring = task.recurring;
  if (!recurring || !recurring.cadence) return undefined;

  const rule: RecurrenceRule = {
    frequency:
      recurring.cadence === "monthly"
        ? "monthly"
        : recurring.cadence === "weekly" || recurring.cadence === "custom-days" || recurring.cadence === "weekdays" || recurring.cadence === "weekends"
        ? "weekly"
        : "daily",
    interval: 1,
    timeOfDay: recurring.timeOfDay,
  };

  switch (recurring.cadence) {
    case "weekdays":
      rule.byWeekday = [1, 2, 3, 4, 5];
      break;
    case "weekends":
      rule.byWeekday = [0, 6];
      break;
    case "custom-days":
      if (recurring.customDays && recurring.customDays.length > 0) {
        rule.byWeekday = recurring.customDays as Weekday[];
      }
      break;
    default:
      break;
  }

  return {
    rule,
    dueTime: recurring.timeOfDay,
    timezone: getDefaultTimezone(),
  };
}

export function addExcludeDateToTask(task: Task, date: string): Task {
  const dateStr = date.includes("T") ? date.split("T")[0] : date;
  const baseSchedule = task.schedule || scheduleFromRecurring(task);
  if (!baseSchedule) return task;
  const excludeDates = Array.from(new Set([...(baseSchedule.excludeDates || []), dateStr]));
  const dueTime = baseSchedule.dueTime || (baseSchedule.cronExpression ? deriveDueTimeFromCron(baseSchedule.cronExpression) : undefined);
  return {
    ...task,
    schedule: {
      ...baseSchedule,
      excludeDates,
      ...(dueTime ? { dueTime } : {}),
    },
  };
}
