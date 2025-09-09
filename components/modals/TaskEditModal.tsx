import React from "react";


import { Chore } from "../ChoresAppContext";

interface TaskEditModalProps {
  open: boolean;
  onClose: () => void;
  task: Chore | null;
  onSave: (task: Chore) => void;
}

export default function TaskEditModal({ open, onClose, task, onSave }: TaskEditModalProps) {
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState("");
  const [color, setColor] = React.useState("#cccccc");
  const [starReward, setStarReward] = React.useState(1);
  const [moneyReward, setMoneyReward] = React.useState(0);

  React.useEffect(() => {
    if (task) {
      setName(task.name);
      setEmoji(task.emoji);
      setColor(task.color);
      setStarReward(task.starReward);
      setMoneyReward(task.moneyReward);
    }
  }, [task]);

  if (!open || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...task, name, emoji, color, starReward, moneyReward });
  };

  return (
    <div className="modal" style={{ display: open ? "block" : "none" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>✏️ Edit Task</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
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
          <div className="modal-footer">
            <button className="btn btn-primary" type="submit">Save</button>
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
