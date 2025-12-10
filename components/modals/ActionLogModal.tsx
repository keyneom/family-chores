import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useChoresApp } from "../ChoresAppContext";

export interface ActionLogModalProps {
  open: boolean;
  onClose: () => void;
  childId?: number;
}

export default function ActionLogModal({ open, onClose, childId }: ActionLogModalProps) {
  const { state } = useChoresApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  const allEntries = (state.actionLog || [])
    .filter(e => {
      if (!childId) return true;
      const p = e.payload;
      if (!p || typeof p !== 'object') return false;
      const payload = p as Record<string, unknown>;
      return payload.childId === childId || 
        (payload.child && typeof payload.child === 'object' && payload.child !== null && (payload.child as Record<string, unknown>).id === childId) || 
        (payload.task && typeof payload.task === 'object' && payload.task !== null && (payload.task as Record<string, unknown>).childId === childId);
    })
    .slice()
    .reverse();

  // Display last 50 entries
  const entries = allEntries.slice(0, 50);
  
  // Export last 100 entries
  const exportEntries = allEntries.slice(0, 100);

  const handleExportJSON = () => {
    const exportData = {
      entries: exportEntries,
      exportedAt: new Date().toISOString(),
      totalEntries: exportEntries.length,
      filteredByChildId: childId || null,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `action-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['id', 'actionType', 'actorHandle', 'timestamp', 'payload'];
    const rows = exportEntries.map(entry => [
      entry.id,
      entry.actionType,
      entry.actorHandle || '',
      entry.timestamp,
      JSON.stringify(entry.payload || {}),
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `action-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Action Log {childId ? `for child ${childId}` : ''}</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body" style={{ maxHeight: '50vh', overflow: 'auto' }}>
          {entries.length === 0 && <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No recent actions</div>}
          {entries.map(entry => (
            <div key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', padding: '12px', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>{new Date(entry.timestamp).toLocaleString()}</div>
              <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1a202c' }}>{entry.actionType}</div>
              {entry.actorHandle && (
                <div style={{ fontSize: '0.75rem', color: '#4a5568', marginBottom: '4px', fontStyle: 'italic' }}>Approved by: {entry.actorHandle}</div>
              )}
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', background: '#f7fafc', padding: '8px', borderRadius: '4px', overflow: 'auto', maxHeight: '200px' }}>{JSON.stringify(entry.payload || {}, null, 2)}</pre>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleExportJSON}>Export JSON (last 100)</button>
          <button className="btn btn-secondary" onClick={handleExportCSV}>Export CSV (last 100)</button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
