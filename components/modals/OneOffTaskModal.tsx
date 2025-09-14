import React, { useState } from "react";
import { useChoresApp, OneOffTask } from "../ChoresAppContext";

interface OneOffTaskModalProps {
  open: boolean;
  onClose: () => void;
  childId?: number;
}

export default function OneOffTaskModal({ open, onClose, childId }: OneOffTaskModalProps) {
  const { dispatch } = useChoresApp();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#FFB6C1");
  const [starReward, setStarReward] = useState(1);
  const [moneyReward, setMoneyReward] = useState(0.5);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskType, setTaskType] = useState<'any-child' | 'first-come' | 'all-children'>('any-child');

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    
    const task: OneOffTask = {
      id: Date.now(),
      name: name.trim(),
      emoji: emoji || "📝",
      color,
      starReward,
      moneyReward,
      date,
      type: taskType,
      assignedTo: taskType === 'any-child' && childId ? childId : undefined,
    };
    
    dispatch({
      type: 'ADD_ONE_OFF_TASK',
      payload: { date, task }
    });
    
    // Reset form
    setName("");
    setEmoji("");
    setColor("#FFB6C1");
    setStarReward(1);
    setMoneyReward(0.5);
    setDate(new Date().toISOString().split('T')[0]);
    setTaskType('any-child');
    onClose();
  };

  return (
    <div className="modal" style={{ display: "block" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>➕ Add One-off Task</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          <div className="input-group">
            <label>Task Name:</label>
            <input
              type="text"
              placeholder="Task name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Emoji:</label>
            <input
              type="text"
              placeholder="Emoji"
              maxLength={2}
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
            />
            <label>Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Star Reward:</label>
            <input
              type="number"
              min={1}
              max={5}
              value={starReward}
              onChange={(e) => setStarReward(Number(e.target.value))}
            />
            <label>Money Reward:</label>
            <input
              type="number"
              min={0}
              step={0.25}
              value={moneyReward}
              onChange={(e) => setMoneyReward(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label>Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Task Type:</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as 'any-child' | 'first-come' | 'all-children')}
            >
              <option value="any-child">Any child can complete</option>
              <option value="first-come">First child to claim gets it</option>
              <option value="all-children">Each child can complete once</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSave}>Add Task</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
