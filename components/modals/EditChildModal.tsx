import React, { useState } from "react";

export interface EditChildModalProps {
  open: boolean;
  onClose: () => void;
  child: { id: number; name: string; stars?: number; money?: number } | null;
  onSave: (child: { id: number; name: string; stars?: number; money?: number }) => void;
  onDelete: (childId: number) => void;
}

export default function EditChildModal({ open, onClose, child, onSave, onDelete }: EditChildModalProps) {
  const [name, setName] = useState("");

  React.useEffect(() => {
    if (child) setName(child.name);
  }, [child]);

  if (!open || !child) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...child, name });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Edit Child</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name:
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <div className="modal-actions">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(child.id)}>
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
