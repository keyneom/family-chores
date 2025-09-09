import React from "react";

interface SyncModalProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function SyncModal({ open, onClose, children }: SyncModalProps) {
  if (!open) return null;
  return (
    <div className="modal" style={{ display: open ? "block" : "none" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>📱 Sync Data</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">{children || <p>Sync options go here.</p>}</div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
