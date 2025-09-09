
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
}



interface TaskItemProps {
  task: Task;
}

export default function TaskItem({ task }: TaskItemProps) {
  const { setState } = useChoresApp();
  const { openTaskEditModal } = useModalControl();

  const handleComplete = () => {
    setState((prev) => ({
      ...prev,
      chores: prev.chores.map((chore) =>
        chore.id === task.id ? { ...chore, isCompleted: true } : chore
      ),
    }));
  } 

  const handleEdit = () => {
    openTaskEditModal(task.id);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      setState(prev => ({
        ...prev,
        chores: prev.chores.filter(chore => chore.id !== task.id)
      }));
    }
  };

  return (
    <div
      className={`task-item${task.isCompleted ? " completed" : ""}`}
      style={{ borderColor: task.color }}
    >
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

