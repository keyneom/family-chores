import React from "react";
import TaskItem, { Task } from "./TaskItem";
import { useChoresApp, Chore } from "./ChoresAppContext";
import { useModalControl } from "./ModalControlContext";

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
  const { state } = useChoresApp();
  const { openEditChildModal } = useModalControl();
  // Filter chores for this child (eligibleChildren empty = all children)
  const childChores = state.chores.filter(
    (chore: Chore) =>
      chore.eligibleChildren.length === 0 ||
      chore.eligibleChildren.includes(child.id)
  );

  return (
    <div className="child-column" data-child-id={child.id}>
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
      <div className="tasks-section">
        <div className="section-title">
          Tasks
          <button
            className="add-task-btn"
            onClick={onAddTask}
          >
            + Add Task
          </button>
        </div>
        <div className="tasks-list">
          {childChores.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}
