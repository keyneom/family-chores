import React, { useState } from "react";

export interface AddChildModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (child: { name: string; blockchainAddress?: string }) => void;
}

export default function AddChildModal({ open, onClose, onAdd }: AddChildModalProps) {
  const [name, setName] = useState("");
  const [blockchainAddress, setBlockchainAddress] = useState<string>("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ name, blockchainAddress: blockchainAddress || undefined });
    setName("");
    setBlockchainAddress("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-tour="add-child-modal">
        <div className="modal-header">
          <h2>Add Child</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <form id="add-child-form" onSubmit={handleSubmit}>
            <label>
              Name:
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Enter child's name" data-tour="child-name-input" />
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
          </form>
        </div>
        <div className="modal-footer">
          <button type="submit" form="add-child-form" className="btn btn-primary" data-tour="add-child-submit-button">Add</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
