import React, { useState } from "react";

export interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (task: { name: string; emoji: string; color: string; starReward: number; moneyReward: number }) => void;
}

export default function AddTaskModal({ open, onClose, onAdd }: AddTaskModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#cccccc");
  const [starReward, setStarReward] = useState(1);
  const [moneyReward, setMoneyReward] = useState(0);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ name, emoji, color, starReward, moneyReward });
    setName("");
    setEmoji("");
    setColor("#cccccc");
    setStarReward(1);
    setMoneyReward(0);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add Task</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name:
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>
            Emoji:
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} required />
          </label>
          <label>
            Color:
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
          </label>
          <label>
            Star Reward:
            <input type="number" value={starReward} min={0} onChange={e => setStarReward(Number(e.target.value))} />
          </label>
          <label>
            Money Reward:
            <input type="number" value={moneyReward} min={0} step={0.01} onChange={e => setMoneyReward(Number(e.target.value))} />
          </label>
          <div className="modal-actions">
            <button type="submit">Add</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
