import React from "react";
import TaskItem from "./TaskItem";
import { useChoresApp, Child } from "./ChoresAppContext";
import { Task, TimedCompletion } from "../types/task";
import { useModalControl } from "./ModalControlContext";
import { shouldChoreRunToday } from "../utils/choreScheduling";
import { assignChoreToChild, assignTaskToChild, generateTaskKey, generateOneOffTaskKey } from "../utils/taskAssignment";
import WalletPayModal from "./modals/WalletPayModal";
import ActionLogModal from "./modals/ActionLogModal";


interface ChildColumnProps {
  child: Child;
  onAddTask?: () => void;
}

export default function ChildColumn({ child, onAddTask }: ChildColumnProps) {
  const { state, dispatch } = useChoresApp();
  const { openEditChildModal } = useModalControl();
  const [payOpen, setPayOpen] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };
  
  const handleDragLeave = () => {
    setDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { taskId, sourceChildId } = dragData;
      
      if (sourceChildId === child.id) return; // Same column
      
      // Update chore eligibility to assign to this child
      dispatch({
        type: 'SET_STATE',
        payload: {
          ...state,
          chores: state.chores.map(chore => 
            chore.id === taskId
              ? { ...chore, eligibleChildren: [child.id] }
              : chore
          )
        }
      });
    } catch (error) {
      console.error('Drop error:', error);
    }
  };

    const handlePayChild = () => {
      if ((child.money || 0) <= 0) {
        alert(`${child.name} has no money to pay out.`);
        return;
      }
      if (confirm(`Pay ${child.name} $${(child.money || 0).toFixed(2)}?`)) {
        dispatch({ type: 'PAY_CHILD', payload: child.id });
      }
    };

  const handlePayOnChain = () => {
    setPayOpen(true);
  };
  
  const today = new Date().toISOString().split('T')[0];
  // Prefer unified tasks if present
  type LegacyRender = {
    id?: number | string;
    name?: string;
    title?: string;
    emoji?: string;
    color?: string;
    starReward?: number;
    stars?: number;
    moneyReward?: number;
    money?: number;
    isCompleted?: boolean;
    taskKey?: string;
    pendingCompletionId?: string | undefined;
    pendingCompletion?: TimedCompletion | undefined;
    type?: string;
  };

  type RenderTask = Task | LegacyRender;

  let activeTasks: RenderTask[] = [];
  let inactiveTasks: RenderTask[] = [];

  if (state.tasks && state.tasks.length > 0) {
    const tasks = state.tasks as Task[];
  tasks.forEach((t: Task) => {
      // determine assigned child
      const assignedChild = assignTaskToChild(t, state.children);
      const taskKey = `${child.id}-${t.id}-${today}`;
      const isCompleted = !!state.completedTasks[taskKey];
      const pending = (state.timedCompletions || []).find((c) => c.taskKey === taskKey && c.childId === child.id && !c.approved);

      // include if assigned to this child
      if (assignedChild && assignedChild.id === child.id) {
        const rec = t as unknown as Record<string, unknown>;
        const mapped = {
          ...t,
          name: (rec.title as string) || (rec.name as string) || '',
          emoji: (rec.emoji as string) || '',
          color: (rec.color as string) || '#cccccc',
          starReward: (typeof rec.stars === 'number' ? (rec.stars as number) : (typeof rec.starReward === 'number' ? (rec.starReward as number) : 0)),
          moneyReward: (typeof rec.money === 'number' ? (rec.money as number) : (typeof rec.moneyReward === 'number' ? (rec.moneyReward as number) : 0)),
          isCompleted,
          taskKey,
          pendingCompletionId: pending?.id,
          pendingCompletion: pending,
        };
        // one-off vs recurring: if oneoff with dueDate, check date
        if (t.type === 'oneoff') {
          const oneOff = t as unknown as { oneOff?: { dueDate?: string } };
          const due = oneOff.oneOff?.dueDate;
          if (due && due.split('T')[0] === today) activeTasks.push(mapped); else inactiveTasks.push(mapped);
        } else {
          // treat recurring and timed as active for today by default
          activeTasks.push(mapped);
        }
      }
    });
  } else {
    // Legacy chores flow
    activeTasks = state.chores
      .filter(chore => shouldChoreRunToday(chore))
      .map(chore => {
        const assignedChild = assignChoreToChild(chore, state.children);
        if (assignedChild?.id === child.id) {
          const taskKey = generateTaskKey(child.id, chore.id);
          const isCompleted = state.completedTasks[taskKey] || false;
          // check for pending timed completion for this taskKey
          const pending = (state.timedCompletions || []).find(c => c.taskKey === taskKey && c.childId === child.id && !c.approved);
          return {
            ...chore,
            isCompleted,
            taskKey,
            type: 'regular' as const,
            pendingCompletionId: pending?.id,
            pendingCompletion: pending,
          };
        }
        return null;
      })
      .filter((task): task is NonNullable<typeof task> => task !== null);
    
    // Get inactive tasks (upcoming tasks not scheduled for today)
    inactiveTasks = state.chores
      .filter(chore => !shouldChoreRunToday(chore))
      .map(chore => {
        const assignedChild = assignChoreToChild(chore, state.children);
        if (assignedChild?.id === child.id) {
          return {
            ...chore,
            isCompleted: false,
            type: 'regular' as const,
          };
        }
        return null;
      })
      .filter((task): task is NonNullable<typeof task> => task !== null);
  }
  
  // Get one-off tasks for today (legacy)
  const oneOffTasks = (state.oneOffTasks[today] || [])
    .filter(task => {
      if (task.assignedTo && task.assignedTo !== child.id) return false;
      if (task.type === 'first-come' && task.completed) return false;
      if (task.type === 'all-children') {
        const taskKey = generateOneOffTaskKey(child.id, task.id, today);
        return !state.completedTasks[taskKey];
      }
      return true;
    })
    .map(task => {
      const taskKey = generateOneOffTaskKey(child.id, task.id, today);
      const pending = (state.timedCompletions || []).find(c => c.taskKey === taskKey && c.childId === child.id && !c.approved);
      return {
        ...task,
        taskKey,
        type: 'one-off' as const,
        isCompleted: false,
        pendingCompletionId: pending?.id,
        pendingCompletion: pending,
      };
    });

  return (
    <div 
      className={`child-column${dragOver ? ' drag-over' : ''}`} 
      data-child-id={child.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && <div className="drop-indicator">Drop task here</div>}
      <div className="child-header">
        <div className="child-name">{child.name}
          <button className="edit-btn" style={{marginLeft: 8}} onClick={() => openEditChildModal(child.id)} title="Edit child">✏️</button>
          <button className="small-pay-btn" style={{ marginLeft: 6 }} onClick={handlePayChild} title="Pay out">💵</button>
          <button className="small-pay-btn" style={{ marginLeft: 6 }} onClick={handlePayOnChain} title="Pay on chain">🌐</button>
          <button className="small-pay-btn" style={{ marginLeft: 6 }} onClick={() => setLogOpen(true)} title="View action log">📝</button>
        </div>
        <div className="child-stats">
          <div className="stat-item">
            <span>⭐</span>
            <span>{child.stars ?? 0}</span>
          </div>
          <div className="stat-item">
            <span>💰</span>
            <span>${(child.money ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="tasks-list">
        <div className="tasks-section">
          <div className="section-title">
            Today&apos;s Tasks
            <button className="add-task-btn" onClick={onAddTask}>
              + Task
            </button>
          </div>
          {activeTasks.length === 0 && oneOffTasks.length === 0 ? (
            <div className="empty-state">No tasks for today</div>
          ) : (
            <>
              {[...activeTasks, ...oneOffTasks].map((task) => {
                const rec = task as unknown as Record<string, unknown>;
                const key = (rec.taskKey as string) || String(rec.id || (rec.title || Math.random().toString(36).slice(2,8)));
                return (<TaskItem key={key} task={task as unknown as Task} childId={child.id} />);
              })}
            </>
          )}
        </div>
        {inactiveTasks.length > 0 && (
          <div className="tasks-section inactive-tasks">
            <div className="section-title">Upcoming Tasks</div>
            <>
              {inactiveTasks.map((task) => {
                const rec = task as unknown as Record<string, unknown>;
                const key = String(rec.id ?? (rec.title || Math.random().toString(36).slice(2,8)));
                return (<TaskItem key={key} task={task as unknown as Task} childId={child.id} />);
              })}
            </>
          </div>
        )}
      </div>
      
      {payOpen && (
        <WalletPayModal open={payOpen} onClose={() => setPayOpen(false)} child={child} defaultAmount={child.money || 0} />
      )}
      {logOpen && (
        <ActionLogModal open={logOpen} onClose={() => setLogOpen(false)} childId={child.id} />
      )}
    </div>
  );
}
