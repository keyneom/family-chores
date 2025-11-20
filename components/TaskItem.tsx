
import React from "react";
import { useChoresApp } from "./ChoresAppContext";
import { useModalControl } from "./ModalControlContext";
import PinModal from "./modals/PinModal";
import TimedCountdown from "./TimedCountdown";
import useTimer from "./hooks/useTimer";
import type { Task as UnifiedTask, TimedCompletion } from "../types/task";

// Renderable shape used by the UI (normalized from legacy or unified task)
interface RenderableTask {
  id: string | number;
  title: string;
  emoji?: string;
  color?: string;
  stars: number;
  money: number;
  isCompleted: boolean;
  taskKey?: string;
  type?: string;
  timedAllowedSeconds?: number;
  pendingCompletionId?: string;
  pendingCompletion?: TimedCompletion | undefined;
}

type LegacyTaskShape = Record<string, unknown>;

type RenderTask = UnifiedTask | LegacyTaskShape;

interface TaskItemProps {
  task: RenderTask;
  childId: number;
}

function normalizeTask(task: RenderTask, childId: number): RenderableTask {
  const rec = task as unknown as Record<string, unknown>;
  const id = rec.id ?? (rec.title ? String(rec.title) : Math.random().toString(36).slice(2,8));
  const type = (rec.type as string) || (rec.timed ? 'timed' : 'recurring');
  const title = (rec.title as string) || (rec.name as string) || '';
  const emoji = (rec.emoji as string) || '';
  const color = (rec.color as string) || '#ccc';
  const stars = typeof rec.stars === 'number' ? (rec.stars as number) : (typeof rec.starReward === 'number' ? (rec.starReward as number) : 0);
  const money = typeof rec.money === 'number' ? (rec.money as number) : (typeof rec.moneyReward === 'number' ? (rec.moneyReward as number) : 0);
  const isCompleted = Boolean(rec.isCompleted as boolean);
  const taskKey = (rec.taskKey as string) || (rec.id ? `${childId}-${String(rec.id)}-${new Date().toISOString().split('T')[0]}` : undefined);
  const timedAllowedSeconds = (rec.timed && (rec.timed as Record<string, unknown>).allowedSeconds) ? Number((rec.timed as Record<string, unknown>).allowedSeconds) : (typeof rec.allowedSeconds === 'number' ? (rec.allowedSeconds as number) : undefined);
  const pendingCompletionId = rec.pendingCompletionId as string | undefined;
  const pendingCompletion = rec.pendingCompletion as TimedCompletion | undefined;

  return {
    id: id as string | number,
    title,
    emoji,
    color,
    stars,
    money,
    isCompleted,
    taskKey,
    type,
    timedAllowedSeconds,
    pendingCompletionId,
    pendingCompletion,
  };
}

export default function TaskItem({ task, childId }: TaskItemProps) {
  const { dispatch } = useChoresApp();
  const { openTaskEditModal } = useModalControl();
  const [pinOpen, setPinOpen] = React.useState(false);
  const [applyMoneyOnApprove, setApplyMoneyOnApprove] = React.useState<boolean>(true);
  const [pendingCompletionActionId, setPendingCompletionActionId] = React.useState<string | null>(null);

  const normalized = normalizeTask(task, childId);
  const { taskKey } = normalized;
  const { activeTimer, start, stop, canStopNow } = useTimer(taskKey, childId);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      taskId: normalized.id,
      taskKey: normalized.taskKey,
      sourceChildId: childId,
      taskType: normalized.type,
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleComplete = () => {
    // For timed tasks, use Start/Stop flow. For non-timed, complete immediately.
    const isTimed = normalized.type === 'timed' || typeof normalized.timedAllowedSeconds === 'number';
    if (isTimed) return;
    if (taskKey) {
      dispatch({
        type: 'COMPLETE_TASK',
        payload: {
          taskKey,
          childId,
          starReward: Number(normalized.stars || 0),
          moneyReward: Number(normalized.money || 0),
        },
      });
    }
  };

  const handleStart = () => start();
  const handleStop = () => stop();

  const handleEdit = () => {
    openTaskEditModal(normalized.id);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      const idVal = normalized.id;
      const idNum = typeof idVal === 'number' ? idVal : Number(idVal);
      if (Number.isNaN(idNum)) {
        // we don't know how to delete non-legacy task ids here
        alert('Cannot delete this task from the legacy delete action. Use the Tasks screen to remove it.');
        return;
      }
      dispatch({ type: 'DELETE_CHORE_TEMPLATE', payload: idNum });
    }
  };

  const handleApprove = () => {
    const pendingId = normalized.pendingCompletionId;
    if (!pendingId) return;
    setPendingCompletionActionId(pendingId);
    setApplyMoneyOnApprove(true);
    setPinOpen(true);
  };

  const handleForgive = () => {
    const pendingId = normalized.pendingCompletionId;
    if (!pendingId) return;
    setPendingCompletionActionId(pendingId);
    setApplyMoneyOnApprove(false);
    setPinOpen(true);
  };

  const onPinSuccess = (actorHandle?: string) => {
    if (!pendingCompletionActionId) return;
    dispatch({ type: 'APPROVE_TIMED_COMPLETION', payload: { completionId: pendingCompletionActionId, approve: true, applyMoney: applyMoneyOnApprove, actorHandle } });
    setPinOpen(false);
    setPendingCompletionActionId(null);
  };

  const { emoji, title, stars, money, color, isCompleted: completed } = normalized;

  return (
    <div
      className={`task-item${completed ? " completed" : ""}`}
      style={{ borderColor: color }}
      draggable={!completed}
      onDragStart={handleDragStart}
    >
      {!completed && <span className="drag-handle">⋮⋮</span>}
      <div className="task-info">
        <span className="task-emoji">{emoji}</span>
        {activeTimer && (
          <div style={{ marginLeft: 8 }}>
            <TimedCountdown startedAt={activeTimer.startedAt} allowedSeconds={activeTimer.allowedSeconds} size={36} />
          </div>
        )}
        <div className="task-details">
          <div className="task-name">{title}</div>
          <div className="task-reward">
            <span>⭐ {Number(stars)}</span>
            <span>💰 ${Number(money).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="task-actions">
        {!(normalized.type === 'timed' || typeof normalized.timedAllowedSeconds === 'number') ? (
          <button
            className="complete-btn"
            onClick={handleComplete}
            disabled={completed}
          >
            {completed ? "✓ Done" : "Complete"}
          </button>
        ) : (
          // Timed task flow: Start -> Stop (stop disabled for first minute)
          activeTimer ? (
            <button className="complete-btn" onClick={handleStop} disabled={!canStopNow}>
              Stop
            </button>
          ) : (
            <button className="complete-btn" onClick={handleStart} disabled={completed}>
              Start
            </button>
          )
        )}
        {/* If there's a pending completion, show parent actions */}
        {normalized.pendingCompletionId && (
          <div className="pending-actions">
            <span className="pending-label">Pending approval</span>
            <button className="approve-btn" onClick={handleApprove}>Approve</button>
            <button className="forgive-btn" onClick={handleForgive}>Forgive</button>
          </div>
        )}
        <button
          className="edit-btn"
          onClick={handleEdit}
          title="Edit task"
        >
          ✏️
        </button>
        <button
          className="btn btn-danger"
          onClick={handleDelete}
          title="Delete task"
        >
          🗑️
        </button>
        <PinModal open={pinOpen} onClose={() => setPinOpen(false)} onSuccess={onPinSuccess} message={applyMoneyOnApprove ? "Approve this timed completion?" : "Forgive money for this timed completion?"} />
      </div>
    </div>
  );
}
