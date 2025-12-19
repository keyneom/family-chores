import { useEffect, useRef } from 'react';
import { useTextToSpeech, VoiceAnnouncementSettings } from './useTextToSpeech';
import { Task, TaskInstance } from '../../types/task';
import { Child } from '../ChoresAppContext';

export interface ScheduledTaskAnnouncementSettings extends VoiceAnnouncementSettings {
  // Announce this many minutes before the task is due
  announceMinutesBefore?: number[];
  // Announce when the task is due
  announceAtDueTime?: boolean;
  // Custom message format - use {taskTitle}, {childName}, {timeUntil}
  messageFormat?: string;
}

const defaultScheduledSettings: ScheduledTaskAnnouncementSettings = {
  enabled: false,
  volume: 1,
  rate: 1,
  pitch: 1,
  announceMinutesBefore: [15, 5], // 15 minutes and 5 minutes before
  announceAtDueTime: true,
  messageFormat: '{childName}, {taskTitle} is coming up in {timeUntil}!',
};

/**
 * Hook to handle voice announcements for upcoming scheduled tasks
 */
export function useScheduledTaskAnnouncements(
  tasks: Array<{ task: Task; instance: TaskInstance; child: Child }>,
  settings?: Partial<ScheduledTaskAnnouncementSettings>
) {
  const mergedSettings = { ...defaultScheduledSettings, ...settings };
  const { speak } = useTextToSpeech(mergedSettings);
  const announcedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!mergedSettings.enabled || tasks.length === 0) {
      announcedRef.current.clear();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const formatTime = (minutes: number): string => {
      if (minutes < 1) {
        return 'less than a minute';
      }
      if (minutes === 1) {
        return '1 minute';
      }
      return `${Math.floor(minutes)} minutes`;
    };

    // Check every 30 seconds for upcoming tasks
    intervalRef.current = setInterval(() => {
      const now = Date.now();

      tasks.forEach(({ task, instance, child }) => {
        if (!instance.dueAt) return;

        const dueAt = new Date(instance.dueAt).getTime();
        const minutesUntil = (dueAt - now) / (1000 * 60);
        const taskKey = `${instance.id}-${child.id}`;

        // Skip if already completed
        if (instance.completed) return;

        // Announce at due time
        if (mergedSettings.announceAtDueTime) {
          const dueKey = `${taskKey}-due`;
          // Within 30 seconds of due time
          if (minutesUntil <= 0.5 && minutesUntil >= -0.5 && !announcedRef.current.has(dueKey)) {
            const message = mergedSettings.messageFormat
              ?.replace(/{taskTitle}/g, task.title || 'your task')
              .replace(/{childName}/g, child.name)
              .replace(/{timeUntil}/g, 'now') || `${child.name}, it's time for ${task.title || 'your task'}!`;
            speak(message);
            announcedRef.current.add(dueKey);
          }
        }

        // Announce minutes before
        if (mergedSettings.announceMinutesBefore) {
          for (const minutes of mergedSettings.announceMinutesBefore) {
            const key = `${taskKey}-${minutes}min`;
            // Within 1 minute window of the target time
            if (
              minutesUntil <= minutes + 0.5 &&
              minutesUntil >= minutes - 0.5 &&
              minutesUntil > 0 &&
              !announcedRef.current.has(key)
            ) {
              const message = mergedSettings.messageFormat
                ?.replace(/{taskTitle}/g, task.title || 'your task')
                .replace(/{childName}/g, child.name)
                .replace(/{timeUntil}/g, formatTime(minutes)) || `${child.name}, ${task.title || 'your task'} is coming up in ${formatTime(minutes)}!`;
              speak(message);
              announcedRef.current.add(key);
            }
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tasks, mergedSettings, speak]);

  // Reset announcements when tasks change
  useEffect(() => {
    announcedRef.current.clear();
  }, [tasks.map(({ instance }) => instance.id).join(',')]);
}

export default useScheduledTaskAnnouncements;

