import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useChoresApp } from "../ChoresAppContext";
import { Task } from "../../types/task";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    
    // Create unified Task with oneOff property
    const task: Task = {
      id: `oneoff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: name.trim(),
      emoji: emoji || "📝",
      color,
      stars: starReward,
      money: moneyReward,
      type: 'oneoff',
      enabled: true,
      createdAt: new Date().toISOString(),
      description: '',
      requirePin: false,
      oneOff: { dueDate: date },
      assignedTo: taskType === 'any-child' && childId ? String(childId) : undefined,
    };
    
    // Create instance for the one-off task
    const instanceId = `instance_${task.id}_${childId || 0}_${date}`;
    const instance = {
      id: instanceId,
      templateId: task.id,
      childId: childId || 0,
      date: date,
      stars: task.stars,
      money: task.money,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    
    dispatch({ type: 'ADD_TASK', payload: task });
    dispatch({ type: 'ADD_TASK_INSTANCE', payload: instance });
    
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

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>➕ Add One-off Task</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
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
          <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); handleSave(); }}>Add Task</button>
          <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); onClose(); }}>Cancel</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
