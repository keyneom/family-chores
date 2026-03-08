import { useCallback, useMemo } from "react";
import { useChoresApp, type Timer } from "../ChoresAppContext";
import { parseTaskKey } from "../../utils/taskKey";

export interface ActiveTimer {
  id: string;
  taskKey: string;
  childId: number;
  startedAt: string;
  allowedSeconds: number;
}

export interface UseTimerReturn {
  activeTimer?: ActiveTimer;
  start: () => void;
  stop: () => void;
  canStopNow: boolean;
}

export function useTimer(taskKey?: string, childId?: number): UseTimerReturn {
  const { state, dispatch } = useChoresApp();

  const activeTimer = useMemo<ActiveTimer | undefined>(() => {
    if (!taskKey || !state.timers) return undefined;
    const timers: Timer[] = Object.values(state.timers);
    const timer = timers.find((t) => t.taskKey === taskKey && t.childId === childId);
    return timer ? {
      id: timer.id,
      taskKey: timer.taskKey,
      childId: timer.childId,
      startedAt: timer.startedAt,
      allowedSeconds: timer.allowedSeconds,
    } : undefined;
  }, [state.timers, taskKey, childId]);

  const start = useCallback(() => {
    if (!taskKey || typeof childId === 'undefined' || childId === null) return;
    
    // If timer already exists, don't create a duplicate - just return
    // The existing timer should continue running
    if (activeTimer) {
      return;
    }
    
    // Otherwise, look up the task to get allowedSeconds
    // taskKey format: childId-taskId-date (date is YYYY-MM-DD, so last 3 parts) or legacy childId:choreId
    let allowedSeconds = 300; // default fallback
    
    const parsed = parseTaskKey(taskKey);
    if (parsed.taskId) {
      const task = state.tasks.find(t => t.id === parsed.taskId);
      if (task?.timed?.allowedSeconds) {
        allowedSeconds = task.timed.allowedSeconds;
      }
    }
    
    const timerId = `t_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const timer = {
      id: timerId,
      taskKey,
      childId,
      startedAt: new Date().toISOString(),
      allowedSeconds,
    };
    dispatch({ type: 'START_TIMER', payload: { timer } });
  }, [taskKey, childId, dispatch, activeTimer, state.tasks]);

  const stop = useCallback(() => {
    if (!activeTimer) return;
    dispatch({ type: 'STOP_TIMER', payload: { timerId: activeTimer.id, stoppedAt: new Date().toISOString() } });
  }, [activeTimer, dispatch]);

  const canStopNow = useMemo(() => {
    if (!activeTimer) return false;
    const started = new Date(activeTimer.startedAt).getTime();
    return (Date.now() - started) >= 5000; // Allow stopping after 5 seconds (reduced from 60)
  }, [activeTimer]);

  return { activeTimer, start, stop, canStopNow };
}

export default useTimer;
