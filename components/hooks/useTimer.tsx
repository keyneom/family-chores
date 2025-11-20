import { useCallback, useMemo } from "react";
import { useChoresApp } from "../ChoresAppContext";

export interface ActiveTimer {
  id: string;
  taskKey: string;
  childId: number;
  startedAt: string;
  allowedSeconds: number;
}

export function useTimer(taskKey?: string, childId?: number) {
  const { state, dispatch } = useChoresApp();

  const activeTimer = useMemo<ActiveTimer | undefined>(() => {
    if (!taskKey || !state.timers) return undefined;
    const timers = Object.values(state.timers) as unknown as ActiveTimer[];
    return timers.find((t) => t.taskKey === taskKey && t.childId === childId);
  }, [state.timers, taskKey, childId]);

  const start = useCallback(() => {
    if (!taskKey || typeof childId === 'undefined' || childId === null) return;
    const timerId = `t_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const allowed = activeTimer?.allowedSeconds ?? 300;
    const timer = {
      id: timerId,
      taskKey,
      childId,
      startedAt: new Date().toISOString(),
      allowedSeconds: allowed,
    };
    dispatch({ type: 'START_TIMER', payload: { timer } });
  }, [taskKey, childId, dispatch, activeTimer]);

  const stop = useCallback(() => {
    if (!activeTimer) return;
    dispatch({ type: 'STOP_TIMER', payload: { timerId: activeTimer.id, stoppedAt: new Date().toISOString() } });
  }, [activeTimer, dispatch]);

  const canStopNow = useMemo(() => {
    if (!activeTimer) return false;
    const started = new Date(activeTimer.startedAt).getTime();
    return (Date.now() - started) >= 60000;
  }, [activeTimer]);

  return { activeTimer, start, stop, canStopNow };
}

export default useTimer;
