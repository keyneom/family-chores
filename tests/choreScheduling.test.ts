import { shouldChoreRunToday, getRecurrenceDescription } from '../utils/choreScheduling';
import { Chore } from '../components/ChoresAppContext';

describe('Chore Scheduling', () => {
  // Mock date for consistent testing
  const mockDate = (year: number, month: number, day: number, dayOfWeek: number) => {
    const originalDate = Date;
    global.Date = jest.fn(() => {
      const date = new originalDate(year, month, day);
      date.getDay = jest.fn(() => dayOfWeek);
      return date;
    }) as unknown as typeof Date;
    global.Date.now = originalDate.now;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('shouldChoreRunToday', () => {
    it('should return true for daily recurrence', () => {
      const chore: Chore = {
        id: 1,
        name: 'Daily Chore',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'daily',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };

      // Test on different days
      mockDate(2024, 0, 1, 1); // Monday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 7, 0); // Sunday
      expect(shouldChoreRunToday(chore)).toBe(true);
    });

    it('should return true for weekly recurrence on matching day', () => {
      // Chore with id % 7 = 1 (Monday)
      const chore: Chore = {
        id: 1,
        name: 'Weekly Chore',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'weekly',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };

      mockDate(2024, 0, 1, 1); // Monday (1 % 7 = 1)
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 2, 2); // Tuesday (1 % 7 = 1, but today is Tuesday)
      expect(shouldChoreRunToday(chore)).toBe(false);
    });

    it('should return true for monthly recurrence on matching day', () => {
      const chore: Chore = {
        id: 1, // 1 % 7 = 1 (Monday)
        name: 'Monthly Chore',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'monthly',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };

      // Note: The monthly implementation calculates the first occurrence of the target day
      // and checks if today's date matches that date. The actual date calculation
      // depends on the first day of the month.
      // For January 2024, the 1st is a Monday, so firstTargetDay would be 1
      // For testing, we'll verify it works on the calculated first occurrence
      // The implementation uses new Date() internally, so we need to mock it properly
      const originalDate = Date;
      const mockDateObj = new originalDate(2024, 0, 1); // Jan 1, 2024 (Monday)
      global.Date = jest.fn(() => mockDateObj) as unknown as typeof Date;
      global.Date.now = originalDate.now;
      
      // The first Monday of January 2024 is the 1st
      // The implementation should return true when date matches firstTargetDay
      expect(shouldChoreRunToday(chore)).toBe(true);
      
      jest.restoreAllMocks();
    });

    it('should return true for weekdays only (Monday-Friday)', () => {
      const chore: Chore = {
        id: 1,
        name: 'Weekday Chore',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'weekdays',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };

      mockDate(2024, 0, 1, 1); // Monday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 5, 5); // Friday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 6, 6); // Saturday
      expect(shouldChoreRunToday(chore)).toBe(false);

      mockDate(2024, 0, 7, 0); // Sunday
      expect(shouldChoreRunToday(chore)).toBe(false);
    });

    it('should return true for weekends only (Saturday-Sunday)', () => {
      const chore: Chore = {
        id: 1,
        name: 'Weekend Chore',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'weekends',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };

      mockDate(2024, 0, 6, 6); // Saturday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 7, 0); // Sunday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 1, 1); // Monday
      expect(shouldChoreRunToday(chore)).toBe(false);
    });

    it('should return true for custom-days on selected days', () => {
      const chore: Chore = {
        id: 1,
        name: 'Custom Chore',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'custom-days',
        customDays: [1, 3, 5], // Monday, Wednesday, Friday
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };

      mockDate(2024, 0, 1, 1); // Monday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 3, 3); // Wednesday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 5, 5); // Friday
      expect(shouldChoreRunToday(chore)).toBe(true);

      mockDate(2024, 0, 2, 2); // Tuesday
      expect(shouldChoreRunToday(chore)).toBe(false);

      mockDate(2024, 0, 6, 6); // Saturday
      expect(shouldChoreRunToday(chore)).toBe(false);
    });
  });

  describe('getRecurrenceDescription', () => {
    it('should return correct description for daily', () => {
      const chore: Chore = {
        id: 1,
        name: 'Daily',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'daily',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };
      expect(getRecurrenceDescription(chore)).toBe('Every day');
    });

    it('should return correct description for weekdays', () => {
      const chore: Chore = {
        id: 1,
        name: 'Weekday',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'weekdays',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };
      expect(getRecurrenceDescription(chore)).toBe('Weekdays only');
    });

    it('should return correct description for weekends', () => {
      const chore: Chore = {
        id: 1,
        name: 'Weekend',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'weekends',
        customDays: [],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };
      expect(getRecurrenceDescription(chore)).toBe('Weekends only');
    });

    it('should return correct description for custom-days', () => {
      const chore: Chore = {
        id: 1,
        name: 'Custom',
        emoji: '📝',
        color: '#ccc',
        recurrence: 'custom-days',
        customDays: [1, 3, 5],
        eligibleChildren: [],
        starReward: 1,
        moneyReward: 1.0,
      };
      const desc = getRecurrenceDescription(chore);
      expect(desc).toContain('Mon');
      expect(desc).toContain('Wed');
      expect(desc).toContain('Fri');
    });
  });
});

