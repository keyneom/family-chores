import {
  describeSchedule,
  doesScheduleRunOnDate,
  getNextExecutionDateTimes,
  buildCronExpressionFromRule,
  getNextOccurrences,
} from '../utils/recurrenceBuilder';
import type { ScheduleDefinition, RecurrenceRule } from '../types/task';

describe('recurrenceBuilder utilities', () => {
  const baseRule: RecurrenceRule = {
    frequency: 'weekly',
    interval: 1,
    byWeekday: [1, 3], // Monday & Wednesday
    startDate: '2024-01-01',
    startTime: '17:00',
    timezone: 'UTC',
  };

  const baseSchedule: ScheduleDefinition = {
    rule: baseRule,
    dueTime: '17:00',
    timezone: 'UTC',
  };

  it('describes schedules with time and timezone', () => {
    const summary = describeSchedule(baseSchedule);
    expect(summary).toContain('Every week');
    expect(summary).toContain('Monday');
    expect(summary).toContain('Wednesday');
    expect(summary).toContain('at');
  });

  it('matches include/exclude dates before rule evaluation', () => {
    const schedule: ScheduleDefinition = {
      ...baseSchedule,
      includeDates: ['2024-01-02'], // Tuesday
      excludeDates: ['2024-01-03'], // Wednesday
    };

    expect(doesScheduleRunOnDate(schedule, '2024-01-02')).toBe(true); // forced include
    expect(doesScheduleRunOnDate(schedule, '2024-01-03')).toBe(false); // forced exclude
    // Monday should still follow weekly rule
    expect(doesScheduleRunOnDate(schedule, '2024-01-01')).toBe(true);
  });

  it('computes upcoming execution date/times', () => {
    const occurrences = getNextExecutionDateTimes(baseSchedule, '2024-01-01', 2);
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]).toMatch(/2024-01-01/);
  });

  it('computes next occurrences', () => {
    const occurrences = getNextOccurrences(baseSchedule, '2024-01-01', 3);
    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences[0]).toBe('2024-01-01'); // Monday
  });

  it('builds cron expression from recurrence rule', () => {
    const cron = buildCronExpressionFromRule(baseRule);
    expect(cron).toBe('0 17 * * 1,3');
  });

  it('handles daily recurrence', () => {
    const dailyRule: RecurrenceRule = {
      frequency: 'daily',
      interval: 2,
      startTime: '09:00',
    };
    const cron = buildCronExpressionFromRule(dailyRule);
    expect(cron).toBe('0 9 */2 * *');
  });

  it('handles monthly recurrence', () => {
    const monthlyRule: RecurrenceRule = {
      frequency: 'monthly',
      interval: 1,
      byMonthday: [15],
      startTime: '12:00',
    };
    const cron = buildCronExpressionFromRule(monthlyRule);
    expect(cron).toBe('0 12 15 */1 *');
  });
});

