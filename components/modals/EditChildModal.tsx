import React, { useState } from "react";
import { Child, useChoresApp } from "../ChoresAppContext";
import PinModal from "./PinModal";

export interface EditChildModalProps {
  open: boolean;
  onClose: () => void;
  child: Child | null;
  onSave: (child: Child) => void;
  onDelete: (childId: number) => void;
}

export default function EditChildModal({ open, onClose, child, onSave, onDelete }: EditChildModalProps) {
  const { state } = useChoresApp();
  const [name, setName] = useState("");
  const [blockchainAddress, setBlockchainAddress] = useState<string>("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<Child | null>(null);

  React.useEffect(() => {
    if (child) {
      setName(child.name);
      setBlockchainAddress(child.blockchainAddress || "");
    }
  }, [child]);

  if (!open || !child) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Child = { ...child!, name, blockchainAddress: blockchainAddress || undefined } as Child;
    const approvalRequired = !!state.parentSettings?.approvals?.editTasks;
    const approversExist = (state.parentSettings.pins || []).length > 0;
    if (approvalRequired) {
      if (!approversExist) {
        alert('Editing requires parent approval, but no approvers are defined. Please add an approver in Settings first.');
        return;
      }
      // store pending changes and open PinModal; on success we'll commit
      setPendingSave(updated);
      setPinOpen(true);
      return;
    }
    onSave(updated);
  };

  const handlePinSuccess = () => {
    if (pendingSave) {
      onSave(pendingSave);
      setPendingSave(null);
    }
    setPinOpen(false);
    onClose();
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
          <label>
            Blockchain Address / ENS:
            <input value={blockchainAddress} onChange={e => setBlockchainAddress(e.target.value)} placeholder="0x or ENS name" />
          </label>
          <div className="modal-actions">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={() => onDelete(child.id)}>
              Delete
            </button>
          </div>
        </form>
        <PinModal open={pinOpen} onClose={() => { setPinOpen(false); setPendingSave(null); }} onSuccess={handlePinSuccess} />
      </div>
    </div>
  );
}
