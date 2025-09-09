import React, { useState } from "react";
import { Chore } from "../ChoresAppContext";

export interface EditChoreModalProps {
  open: boolean;
  onClose: () => void;
  chore: Chore | null;
  onSave: (chore: Chore) => void;
  onDelete: (choreId: number) => void;
}

export default function EditChoreModal({ open, onClose, chore, onSave, onDelete }: EditChoreModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#cccccc");
  const [starReward, setStarReward] = useState(1);
  const [moneyReward, setMoneyReward] = useState(0);

  React.useEffect(() => {
    if (chore) {
      setName(chore.name);
      setEmoji(chore.emoji);
      setColor(chore.color);
      setStarReward(chore.starReward);
      setMoneyReward(chore.moneyReward);
    }
  }, [chore]);

  if (!open || !chore) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...chore, name, emoji, color, starReward, moneyReward });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Edit Chore</h2>
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
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(chore.id)}>
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
