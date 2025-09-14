import React from "react";
import TaskItem from "./TaskItem";
import { useChoresApp } from "./ChoresAppContext";
import { useModalControl } from "./ModalControlContext";
import { shouldChoreRunToday } from "../utils/choreScheduling";
import { assignChoreToChild, generateTaskKey, generateOneOffTaskKey } from "../utils/taskAssignment";

export interface Child {
  id: number;
  name: string;
  stars?: number;
  money?: number;
}




interface ChildColumnProps {
  child: Child;
  onAddTask?: () => void;
}

export default function ChildColumn({ child, onAddTask }: ChildColumnProps) {
  const { state, dispatch } = useChoresApp();
  const { openEditChildModal } = useModalControl();
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
  
  const today = new Date().toISOString().split('T')[0];
  
  // Get active tasks (should run today and assigned to this child)
  const activeTasks = state.chores
    .filter(chore => shouldChoreRunToday(chore))
    .map(chore => {
      const assignedChild = assignChoreToChild(chore, state.children);
      if (assignedChild?.id === child.id) {
        const taskKey = generateTaskKey(child.id, chore.id);
        const isCompleted = state.completedTasks[taskKey] || false;
        return {
          ...chore,
          isCompleted,
          taskKey,
          type: 'regular' as const,
        };
      }
      return null;
    })
    .filter((task): task is NonNullable<typeof task> => task !== null);
  
  // Get inactive tasks (upcoming tasks not scheduled for today)
  const inactiveTasks = state.chores
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
  
  // Get one-off tasks for today
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
    .map(task => ({
      ...task,
      taskKey: generateOneOffTaskKey(child.id, task.id, today),
      type: 'one-off' as const,
      isCompleted: false,
    }));

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
            [...activeTasks, ...oneOffTasks].map((task) => (
              <TaskItem key={task.taskKey || task.id} task={task} childId={child.id} />
            ))
          )}
        </div>
        {inactiveTasks.length > 0 && (
          <div className="tasks-section inactive-tasks">
            <div className="section-title">Upcoming Tasks</div>
            {inactiveTasks.map((task) => (
              <TaskItem key={task.id} task={task} childId={child.id} />
            ))}
          </div>
        )}
      </div>
      <div className="payment-controls">
        <button className="payment-btn" onClick={handlePayChild}>
          💰 Pay ${(child.money || 0).toFixed(2)}
        </button>
      </div>
    </div>
  );
}
