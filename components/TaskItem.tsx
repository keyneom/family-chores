
import { useChoresApp } from "./ChoresAppContext";
import { useModalControl } from "./ModalControlContext";

export interface Task {
  id: number;
  name: string;
  emoji: string;
  color: string;
  starReward: number;
  moneyReward: number;
  isCompleted?: boolean;
  taskKey?: string;
  type?: 'regular' | 'one-off';
}



interface TaskItemProps {
  task: Task;
  childId: number;
}

export default function TaskItem({ task, childId }: TaskItemProps) {
  const { dispatch } = useChoresApp();
  const { openTaskEditModal } = useModalControl();
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      taskId: task.id,
      taskKey: task.taskKey,
      sourceChildId: childId,
      taskType: task.type
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleComplete = () => {
    if (task.taskKey) {
      dispatch({
        type: 'COMPLETE_TASK',
        payload: {
          taskKey: task.taskKey,
          childId,
          starReward: task.starReward,
          moneyReward: task.moneyReward,
        },
      });
    }
  }; 

  const handleEdit = () => {
    openTaskEditModal(task.id);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      dispatch({ type: 'DELETE_CHORE_TEMPLATE', payload: task.id });
    }
  };

  return (
    <div
      className={`task-item${task.isCompleted ? " completed" : ""}`}
      style={{ borderColor: task.color }}
      draggable={!task.isCompleted}
      onDragStart={handleDragStart}
    >
      {!task.isCompleted && <span className="drag-handle">⋮⋮</span>}
      <div className="task-info">
        <span className="task-emoji">{task.emoji}</span>
        <div className="task-details">
          <div className="task-name">{task.name}</div>
          <div className="task-reward">
            <span>⭐ {task.starReward}</span>
            <span>💰 ${task.moneyReward.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="task-actions">
        <button
          className="complete-btn"
          onClick={handleComplete}
          disabled={task.isCompleted}
        >
          {task.isCompleted ? "✓ Done" : "Complete"}
        </button>
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
      </div>
    </div>
  );
}

