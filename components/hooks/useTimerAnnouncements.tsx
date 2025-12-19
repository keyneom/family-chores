import { useEffect, useRef } from 'react';
import { useTextToSpeech, VoiceAnnouncementSettings } from './useTextToSpeech';
import { Timer } from '../ChoresAppContext';
import { Task } from '../../types/task';

export interface TimerAnnouncementSettings extends VoiceAnnouncementSettings {
  // Announce at these percentages of time elapsed (0-1)
  // e.g., [0.5, 0.75, 0.9] means announce at 50%, 75%, and 90% complete
  announceAtPercentages?: number[];
  // Announce when this many seconds remain
  announceAtSecondsRemaining?: number[];
  // Announce at start
  announceAtStart?: boolean;
  // Custom message format - use {taskTitle}, {childName}, {remaining}, {elapsed}
  messageFormat?: string;
}

const defaultTimerSettings: TimerAnnouncementSettings = {
  enabled: false,
  volume: 1,
  rate: 1,
  pitch: 1,
  announceAtPercentages: [0.5, 0.75, 0.9],
  announceAtSecondsRemaining: [60, 30, 10], // 1 minute, 30 seconds, 10 seconds
  announceAtStart: true,
  messageFormat: '{childName}, time to start {taskTitle}!',
};

/**
 * Hook to handle voice announcements during timed tasks
 */
export function useTimerAnnouncements(
  timer: Timer | undefined,
  task: Task | undefined,
  childName: string,
  settings?: Partial<TimerAnnouncementSettings>
) {
  const mergedSettings = { ...defaultTimerSettings, ...settings };
  const { speak } = useTextToSpeech(mergedSettings);
  const announcedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!timer || !task || !mergedSettings.enabled) {
      announcedRef.current.clear();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const startedAt = new Date(timer.startedAt).getTime();
    const allowedSeconds = timer.allowedSeconds;
    const taskTitle = task.title || 'your task';
    
    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins > 0) {
        return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
      }
      return `${secs} second${secs !== 1 ? 's' : ''}`;
    };

    const formatMessage = (template: string, remaining?: number, elapsed?: number): string => {
      let message = template
        .replace(/{taskTitle}/g, taskTitle)
        .replace(/{childName}/g, childName);
      
      if (remaining !== undefined) {
        message = message.replace(/{remaining}/g, formatTime(remaining));
      }
      if (elapsed !== undefined) {
        message = message.replace(/{elapsed}/g, formatTime(elapsed));
      }
      
      return message;
    };

    // Announce at start
    if (mergedSettings.announceAtStart) {
      const startKey = 'start';
      if (!announcedRef.current.has(startKey)) {
        const message = formatMessage(
          mergedSettings.messageFormat || '{childName}, time to start {taskTitle}!'
        );
        speak(message);
        announcedRef.current.add(startKey);
      }
    }

    // Check every second for announcements
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const remaining = Math.max(0, allowedSeconds - elapsed);
      const progress = Math.min(1, elapsed / allowedSeconds);

      // Check percentage-based announcements
      if (mergedSettings.announceAtPercentages) {
        for (const percentage of mergedSettings.announceAtPercentages) {
          const key = `percent-${percentage}`;
          if (progress >= percentage && !announcedRef.current.has(key)) {
            const message = formatMessage(
              `{childName}, you're ${Math.round(percentage * 100)}% done with {taskTitle}. ${remaining > 0 ? formatTime(remaining) + ' remaining.' : 'Time is up!'}`,
              remaining,
              elapsed
            );
            speak(message);
            announcedRef.current.add(key);
          }
        }
      }

      // Check time-remaining announcements
      if (mergedSettings.announceAtSecondsRemaining) {
        for (const seconds of mergedSettings.announceAtSecondsRemaining) {
          const key = `remaining-${seconds}`;
          if (remaining <= seconds && remaining > seconds - 1 && !announcedRef.current.has(key)) {
            const message = formatMessage(
              `{childName}, {taskTitle} - ${formatTime(remaining)} remaining!`,
              remaining,
              elapsed
            );
            speak(message);
            announcedRef.current.add(key);
          }
        }
      }

      // Announce when time is up
      if (remaining === 0 && !announcedRef.current.has('timeup')) {
        const message = formatMessage(
          `{childName}, time is up for {taskTitle}!`
        );
        speak(message);
        announcedRef.current.add('timeup');
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timer, task, childName, mergedSettings, speak]);

  // Reset announcements when timer changes
  useEffect(() => {
    announcedRef.current.clear();
  }, [timer?.id]);
}

export default useTimerAnnouncements;

