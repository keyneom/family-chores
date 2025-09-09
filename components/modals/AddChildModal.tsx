import React, { useState } from "react";

export interface AddChildModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (child: { name: string }) => void;
}

export default function AddChildModal({ open, onClose, onAdd }: AddChildModalProps) {
  const [name, setName] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ name });
    setName("");
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add Child</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name:
            <input value={name} onChange={e => setName(e.target.value)} required />
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
