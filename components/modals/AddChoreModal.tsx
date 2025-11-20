import React, { useState } from "react";

export interface AddChoreModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (chore: { name: string; emoji: string; color: string; starReward: number; moneyReward: number; timed?: boolean; allowedSeconds?: number; latePenaltyPercent?: number; autoApproveOnStop?: boolean }) => void;
}

export default function AddChoreModal({ open, onClose, onAdd }: AddChoreModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#cccccc");
  const [starReward, setStarReward] = useState(1);
  const [moneyReward, setMoneyReward] = useState(0);
  const [timed, setTimed] = useState(false);
  const [allowedMinutes, setAllowedMinutes] = useState(5);
  const [latePenaltyPercent, setLatePenaltyPercent] = useState(50);
  const [autoApproveOnStop, setAutoApproveOnStop] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  onAdd({ name, emoji, color, starReward, moneyReward, timed, allowedSeconds: Math.round(allowedMinutes * 60), latePenaltyPercent: latePenaltyPercent / 100, autoApproveOnStop });
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
        <h2>Add Chore</h2>
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
          <label>
            Timed Task:
            <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />
          </label>
          {timed && (
            <>
              <label>
                Allowed Minutes:
                <input type="number" value={allowedMinutes} min={1} onChange={e => setAllowedMinutes(Number(e.target.value))} />
              </label>
              <label>
                Late Penalty (% of reward when late):
                <input type="number" value={latePenaltyPercent} min={-200} max={200} onChange={e => setLatePenaltyPercent(Number(e.target.value))} />
              </label>
              <label>
                Auto-approve on Stop:
                <input type="checkbox" checked={autoApproveOnStop} onChange={e => setAutoApproveOnStop(e.target.checked)} />
              </label>
            </>
          )}
          <div className="modal-actions">
            <button type="submit">Add</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
