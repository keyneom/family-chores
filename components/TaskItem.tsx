
import React from "react";
import { useChoresApp } from "./ChoresAppContext";
import { useModalControl } from "./ModalControlContext";
import PinModal from "./modals/PinModal";
import AlertModal from "./modals/AlertModal";
import DeleteTaskModal, { DeleteOption } from "./modals/DeleteTaskModal";
import EditTaskConfirmModal, { EditOption } from "./modals/EditTaskConfirmModal";
import TimedCountdown from "./TimedCountdown";
import useTimer from "./hooks/useTimer";
import type { Task, TimedCompletion, TaskInstance } from "../types/task";
import { getTodayString } from "../utils/dateUtils";

// Renderable shape used by the UI (Task with metadata added by ChildColumn)
interface RenderableTask extends Task {
  isCompleted: boolean;
  taskKey: string;
  timedAllowedSeconds?: number;
  pendingCompletionId?: string;
  pendingCompletion?: TimedCompletion;
}

interface TaskItemProps {
  task: Task & { isCompleted?: boolean; taskKey?: string; pendingCompletionId?: string; pendingCompletion?: TimedCompletion; instance?: TaskInstance };
  instance?: TaskInstance; // Instance for this task occurrence
  childId: number;
}

function normalizeTask(task: TaskItemProps['task'], childId: number): RenderableTask {
  const today = getTodayString();
  const taskKey = task.taskKey || `${childId}-${task.id}-${today}`;
  
  return {
    ...task,
    id: task.id,
    title: task.title,
    emoji: task.emoji || '',
    color: task.color || '#ccc',
    stars: task.stars || 0,
    money: task.money || 0,
    isCompleted: Boolean(task.isCompleted),
    taskKey,
    type: task.type,
    timedAllowedSeconds: task.timed?.allowedSeconds,
    pendingCompletionId: task.pendingCompletionId,
    pendingCompletion: task.pendingCompletion,
  };
}

export default function TaskItem({ task, instance, childId }: TaskItemProps) {
  const { state, dispatch } = useChoresApp();
  const { openTaskEditModal } = useModalControl();
  const [pinOpen, setPinOpen] = React.useState(false);
  const [applyMoneyOnApprove, setApplyMoneyOnApprove] = React.useState<boolean>(true);
  const [pendingCompletionActionId, setPendingCompletionActionId] = React.useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);

  // Use instance if provided, otherwise fall back to task metadata
  const actualInstance = instance || task.instance;
  const normalized = normalizeTask(task, childId);
  const today = getTodayString();
  // Construct taskKey consistently - use instance date if available, otherwise today
  const instanceDate = actualInstance?.date || today;
  const taskKey = normalized.taskKey || `${childId}-${normalized.id}-${instanceDate}`;
  const isCompleted = actualInstance ? actualInstance.completed : normalized.isCompleted;
  const { activeTimer, start, stop, canStopNow } = useTimer(taskKey, childId);
  
  // Look up pending completion directly from state (in case it wasn't passed in the task prop)
  const pendingCompletion = React.useMemo(() => {
    // First check if it was passed in the task prop
    if (normalized.pendingCompletionId && normalized.pendingCompletion) {
      return normalized.pendingCompletion;
    }
    // Otherwise, look it up from state - try exact match first
    let found = (state.timedCompletions || []).find(
      (c) => c.taskKey === taskKey && c.childId === childId && !c.approved
    );
    
    // If not found, try matching by taskId and date (in case taskKey format differs slightly)
    if (!found && normalized.id) {
      found = (state.timedCompletions || []).find(
        (c) => {
          // Parse taskKey to extract taskId and date
          const parts = c.taskKey.split('-');
          if (parts.length >= 5) {
            // Format: childId-taskId-YYYY-MM-DD
            const completionTaskId = parts.slice(1, -3).join('-');
            const completionDate = parts.slice(-3).join('-');
            return completionTaskId === normalized.id && 
                   completionDate === instanceDate && 
                   c.childId === childId && 
                   !c.approved;
          }
          return false;
        }
      );
    }
    
    return found;
  }, [state.timedCompletions, taskKey, childId, normalized.pendingCompletionId, normalized.pendingCompletion, normalized.id, instanceDate]);
  
  const pendingCompletionId = normalized.pendingCompletionId || pendingCompletion?.id;

  const handleDragStart = (e: React.DragEvent) => {
    const instanceDate = actualInstance?.date || getTodayString();
    e.dataTransfer.setData('text/plain', JSON.stringify({
      taskId: normalized.id,
      taskKey: normalized.taskKey,
      sourceChildId: childId,
      taskType: normalized.type,
      instanceDate,
    }));
    e.dataTransfer.effectAllowed = 'move';
    // Stop propagation to prevent child column drag handlers from intercepting
    e.stopPropagation();
  };

  const handleComplete = () => {
    // For timed tasks, use Start/Stop flow. For non-timed, complete immediately.
    const isTimed = !!normalized.timed || typeof normalized.timedAllowedSeconds === 'number';
    if (isTimed) return;
    
    // Check if this is an early completion (future task)
    const today = getTodayString();
    const instanceDate = actualInstance?.date || today;
    const isEarlyCompletion = instanceDate > today;
    
    // Check if approval is required - use earlyComplete for future tasks, taskComplete for today/past
    const requiresApproval = isEarlyCompletion 
      ? state.parentSettings.approvals.earlyComplete
      : state.parentSettings.approvals.taskComplete;
    const approvers = state.parentSettings.pins || [];
    
    if (requiresApproval) {
      if (approvers.length === 0) {
        setAlertOpen(true);
        return;
      }
      // Store the completion action and request PIN
      setPendingCompletionActionId(actualInstance?.id || taskKey || '');
      setPinOpen(true);
      return;
    }
    
    // No approval required, complete immediately
    performCompletion();
  };

  const performCompletion = () => {
    if (actualInstance) {
      // Use instance-based completion
      dispatch({
        type: 'COMPLETE_TASK_INSTANCE',
        payload: {
          instanceId: actualInstance.id,
          childId,
          starReward: Number((actualInstance.stars ?? normalized.stars) || 0),
          moneyReward: Number((actualInstance.money ?? normalized.money) || 0),
        },
      });
    } else if (taskKey) {
      // Fallback to legacy completion
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
    setEditConfirmOpen(true);
  };

  const confirmEdit = (option: EditOption) => {
    setEditConfirmOpen(false);
    // Open the edit modal with the selected option and instance ID
    openTaskEditModal(normalized.id, option, actualInstance?.id);
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = (option: DeleteOption) => {
    const taskIdToDelete = String(normalized.id);
    const instanceIdToDelete = actualInstance?.id;
    const today = new Date().toISOString().split('T')[0];
    
    switch (option) {
      case 'instance':
        // Delete just this instance
        if (instanceIdToDelete) {
          dispatch({ type: 'DELETE_TASK_INSTANCE', payload: instanceIdToDelete });
        }
        break;
        
      case 'future':
        // Disable the task from generating future instances
        // We'll mark it as disabled after today
        dispatch({ 
          type: 'DISABLE_TASK_AFTER_DATE', 
          payload: { taskId: taskIdToDelete, date: today } 
        });
        // Also delete today's instance if it exists
        if (instanceIdToDelete) {
          dispatch({ type: 'DELETE_TASK_INSTANCE', payload: instanceIdToDelete });
        }
        break;
        
      case 'template':
        // Delete the entire task template
        dispatch({ type: 'DELETE_TASK', payload: taskIdToDelete });
        // Also delete the instance if it exists
        if (instanceIdToDelete) {
          dispatch({ type: 'DELETE_TASK_INSTANCE', payload: instanceIdToDelete });
        }
        break;
    }
    
    setDeleteConfirmOpen(false);
  };

  const handleApprove = () => {
    const pendingId = pendingCompletionId;
    if (!pendingId) return;
    setPendingCompletionActionId(pendingId);
    setApplyMoneyOnApprove(true);
    setPinOpen(true);
  };

  const handleForgive = () => {
    const pendingId = pendingCompletionId;
    if (!pendingId) return;
    setPendingCompletionActionId(pendingId);
    setApplyMoneyOnApprove(false);
    setPinOpen(true);
  };

  const onPinSuccess = (actorHandle?: string) => {
    setPinOpen(false);
    
    // Check if this is for a timed completion approval
    if (pendingCompletionActionId && pendingCompletionId) {
      dispatch({ type: 'APPROVE_TIMED_COMPLETION', payload: { completionId: pendingCompletionActionId, approve: true, applyMoney: applyMoneyOnApprove, actorHandle } });
      setPendingCompletionActionId(null);
    } else {
      // Regular task completion
      performCompletion();
    }
  };

  const { emoji, title, color } = normalized;
  const stars = actualInstance?.stars ?? normalized.stars ?? 0;
  const money = actualInstance?.money ?? normalized.money ?? 0;
  const completed = isCompleted;

  return (
    <div
      className={`task-item${completed ? " completed" : ""}`}
      style={{ borderColor: color }}
      draggable={!completed}
      onDragStart={handleDragStart}
      data-task-id={normalized.id}
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
        {!(normalized.timed || typeof normalized.timedAllowedSeconds === 'number') ? (
          <button
            className="complete-btn"
            onClick={handleComplete}
            disabled={completed}
          >
            {completed ? "✓ Done" : "Complete"}
          </button>
        ) : (
          // Timed task flow: Start -> Stop -> Pending Approval -> Complete
          pendingCompletionId ? (
            // If there's a pending completion, show parent approval actions (no Start/Stop)
            <div className="pending-actions">
              <span className="pending-label">Pending approval</span>
              <button className="approve-btn" onClick={handleApprove}>Approve</button>
              <button className="forgive-btn" onClick={handleForgive}>Forgive</button>
            </div>
          ) : activeTimer ? (
            // Timer is running, show Stop button
            <button className="complete-btn" onClick={handleStop} disabled={!canStopNow}>
              Stop
            </button>
          ) : (
            // No timer and no pending completion, show Start button
            <button className="complete-btn" onClick={handleStart} disabled={completed}>
              Start
            </button>
          )
        )}
        <button
          className="btn-icon-text btn-edit"
          onClick={handleEdit}
          title="Edit task"
        >
          <span className="btn-icon">✏️</span>
          <span className="btn-text">Edit</span>
        </button>
        <button
          className="btn-icon-text btn-danger"
          onClick={handleDelete}
          title="Delete task"
        >
          <span className="btn-icon">🗑️</span>
          <span className="btn-text">Delete</span>
        </button>
        <PinModal 
          open={pinOpen} 
          onClose={() => { setPinOpen(false); setPendingCompletionActionId(null); }} 
          onSuccess={onPinSuccess} 
          message={
            pendingCompletionActionId && pendingCompletionId
              ? (applyMoneyOnApprove ? "Approve this timed completion?" : "Forgive money for this timed completion?")
              : "Enter a parent PIN to complete this task."
          } 
        />
        <AlertModal
          open={alertOpen}
          onClose={() => setAlertOpen(false)}
          title="Approval Required"
          message={
            (() => {
              const today = getTodayString();
              const instanceDate = actualInstance?.date || today;
              const isEarlyCompletion = instanceDate > today;
              return isEarlyCompletion
                ? "Early task completion requires parent approval, but no approvers are defined. Please add an approver in Settings first."
                : "Task completion requires parent approval, but no approvers are defined. Please add an approver in Settings first.";
            })()
          }
        />
        <EditTaskConfirmModal
          open={editConfirmOpen}
          onClose={() => setEditConfirmOpen(false)}
          onConfirm={confirmEdit}
          task={normalized}
          taskTitle={normalized.title}
        />
        <DeleteTaskModal
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={confirmDelete}
          task={normalized}
          taskTitle={normalized.title}
        />
      </div>
    </div>
  );
}
