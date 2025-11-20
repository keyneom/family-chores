import React from "react";
import { useChoresApp } from "../ChoresAppContext";

export interface ActionLogModalProps {
  open: boolean;
  onClose: () => void;
  childId?: number;
}

export default function ActionLogModal({ open, onClose, childId }: ActionLogModalProps) {
  const { state } = useChoresApp();
  if (!open) return null;

  const entries = (state.actionLog || [])
    .filter(e => {
      if (!childId) return true;
      const p = e.payload || {};
      return p.childId === childId || (p.child && p.child.id === childId) || (p.task && p.task.childId === childId);
    })
    .slice()
    .reverse()
    .slice(0, 50);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Action Log {childId ? `for child ${childId}` : ''}</h2>
        <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
          {entries.length === 0 && <div>No recent actions</div>}
          {entries.map(entry => (
            <div key={entry.id} style={{ borderBottom: '1px solid #eee', padding: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>{new Date(entry.timestamp).toLocaleString()}</div>
              <div><strong>{entry.actionType}</strong></div>
              {entry.actorHandle && (
                <div style={{ fontSize: 12, color: '#333' }}><em>Approved by: {entry.actorHandle}</em></div>
              )}
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(entry.payload || {}, null, 2)}</pre>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
