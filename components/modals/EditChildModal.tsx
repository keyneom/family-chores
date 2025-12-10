import React, { useState } from "react";
import { Child, useChoresApp } from "../ChoresAppContext";
import PinModal from "./PinModal";
import AlertModal from "./AlertModal";

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
  const [alertOpen, setAlertOpen] = useState(false);

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
        setAlertOpen(true);
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Child</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <form id="edit-child-form" onSubmit={handleSubmit}>
            <label>
              Name:
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Enter child's name" />
            </label>
            <label>
              <span>Blockchain Address / ENS:</span>
              <input 
                value={blockchainAddress} 
                onChange={e => setBlockchainAddress(e.target.value)} 
                placeholder="0x or ENS name (optional)" 
              />
            </label>
            {blockchainAddress && blockchainAddress.trim() && (
              <div style={{ marginTop: '-8px', marginBottom: '12px', marginLeft: 'auto', width: 'fit-content' }}>
                <a
                  href={`https://etherscan.io/address/${blockchainAddress.trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    fontSize: '0.9rem', 
                    color: '#4299e1', 
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #4299e1',
                    transition: 'all 0.2s',
                    display: 'inline-block'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4299e1';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#4299e1';
                  }}
                >
                  🔗 View on Etherscan
                </a>
              </div>
            )}
            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#666' }}>Stars Earned:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>⭐ {child.stars}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#666' }}>Money Earned:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>💰 ${child.money.toFixed(2)}</span>
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button type="submit" form="edit-child-form" className="btn btn-primary">Save</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={() => onDelete(child.id)}>
            Delete
          </button>
        </div>
        <PinModal open={pinOpen} onClose={() => { setPinOpen(false); setPendingSave(null); }} onSuccess={handlePinSuccess} />
        <AlertModal
          open={alertOpen}
          onClose={() => setAlertOpen(false)}
          title="Approval Required"
          message="Editing requires parent approval, but no approvers are defined. Please add an approver in Settings first."
        />
      </div>
    </div>
  );
}
