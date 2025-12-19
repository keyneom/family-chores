import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useChoresApp } from "../ChoresAppContext";
import AlertModal from "./AlertModal";
import ConfirmationModal from "./ConfirmationModal";
import PinModal from "./PinModal";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onCreateTask: () => void;
  onEditTask: (taskId: string) => void;
  onEditChild?: (childId: number) => void;
}

type ApproverErrors = {
  handle?: string;
  pin?: string;
  confirm?: string;
};

type ToastMessage = {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  dismissible?: boolean;
  durationMs?: number;
};

export default function SettingsModal({ open, onClose, onCreateTask, onEditTask, onEditChild }: SettingsModalProps) {
  const { state, dispatch } = useChoresApp();
  const [newChildName, setNewChildName] = useState("");
  const [newChildBlockchain, setNewChildBlockchain] = useState("");
  // Legacy single PIN removed. Approvers are managed via `pins` below.
  const [newPinHandle, setNewPinHandle] = useState("");
  const [newPinCode, setNewPinCode] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [showAddApproverInline, setShowAddApproverInline] = useState(false);
  const [pendingApprovalKey, setPendingApprovalKey] = useState<null | keyof typeof state.parentSettings.approvals>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [approverErrors, setApproverErrors] = useState<ApproverErrors>({});
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMessage, setPinModalMessage] = useState<string | undefined>();
  const pinModalActionRef = useRef<((actorHandle?: string) => void) | null>(null);
  const [localApprovals, setLocalApprovals] = useState(state.parentSettings.approvals);
  const [localVoiceSettings, setLocalVoiceSettings] = useState(state.parentSettings.voiceAnnouncements || {
    enabled: false,
    volume: 1,
    rate: 1,
    pitch: 1,
    timerAnnouncements: {
      enabled: false,
      announceAtPercentages: [0.5, 0.75, 0.9],
      announceAtSecondsRemaining: [60, 30, 10],
      announceAtStart: true,
    },
    scheduledAnnouncements: {
      enabled: false,
      announceMinutesBefore: [15, 5],
      announceAtDueTime: true,
    },
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset local approvals when modal opens
  useEffect(() => {
    if (open) {
      setLocalApprovals(state.parentSettings.approvals);
      setLocalVoiceSettings(state.parentSettings.voiceAnnouncements || {
        enabled: false,
        volume: 1,
        rate: 1,
        pitch: 1,
        timerAnnouncements: {
          enabled: false,
          announceAtPercentages: [0.5, 0.75, 0.9],
          announceAtSecondsRemaining: [60, 30, 10],
          announceAtStart: true,
        },
        scheduledAnnouncements: {
          enabled: false,
          announceMinutesBefore: [15, 5],
          announceAtDueTime: true,
        },
      });
    }
  }, [open, state.parentSettings.approvals, state.parentSettings.voiceAnnouncements]);

  useEffect(() => {
    return () => {
      Object.values(toastTimeoutsRef.current).forEach(timeoutId => clearTimeout(timeoutId));
      toastTimeoutsRef.current = {};
    };
  }, []);

  if (!open || !mounted) return null;

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    
    // Check if approval is required for editing tasks and children
    const requiresApproval = state.parentSettings.approvals.editTasks;
    const approvers = state.parentSettings.pins || [];
    
    if (requiresApproval) {
      if (approvers.length === 0) {
        showAlert('Adding children requires parent approval, but no approvers are defined. Please add an approver first.');
        return;
      }
      requestPinVerification('Enter a parent PIN to add a child.', (actorHandle) => {
        dispatch({
          type: "ADD_CHILD",
          payload: {
            id: Date.now(),
            name: newChildName.trim(),
            stars: 0,
            money: 0,
            blockchainAddress: newChildBlockchain || undefined,
          },
        });
        setNewChildName("");
        setNewChildBlockchain("");
        showToast('Child added', 'success');
      });
      return;
    }
    
    // No approval required
    dispatch({
      type: "ADD_CHILD",
      payload: {
        id: Date.now(),
        name: newChildName.trim(),
        stars: 0,
        money: 0,
        blockchainAddress: newChildBlockchain || undefined,
      }
    });
    setNewChildName("");
    setNewChildBlockchain("");
  };

  const handleDeleteChild = (childId: number) => {
    dispatch({ type: "DELETE_CHILD", payload: childId });
  };

  const handleDeleteChore = (taskId: string) => {
    dispatch({ type: "DELETE_TASK", payload: taskId });
  };

  // legacy single PIN removed — no handler

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (toastTimeoutsRef.current[id]) {
      clearTimeout(toastTimeoutsRef.current[id]);
      delete toastTimeoutsRef.current[id];
    }
  };

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'info',
    options: { dismissible?: boolean; durationMs?: number } = {}
  ) => {
    const toast: ToastMessage = {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      type,
      dismissible: options.dismissible,
      durationMs: options.durationMs,
    };
    setToasts(prev => [...prev, toast]);

    if (!options.dismissible) {
      const timeout = setTimeout(() => removeToast(toast.id), options.durationMs ?? 4000);
      toastTimeoutsRef.current[toast.id] = timeout;
    }
  };

  const clearApproverError = (field: keyof ApproverErrors) => {
    setApproverErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const requestPinVerification = (message: string, onVerified: (actorHandle?: string) => void) => {
    setPinModalMessage(message);
    pinModalActionRef.current = onVerified;
    setPinModalOpen(true);
  };

  const handlePinModalClose = () => {
    pinModalActionRef.current = null;
    setPinModalOpen(false);
  };

  const handlePinModalSuccess = (actorHandle?: string) => {
    pinModalActionRef.current?.(actorHandle);
    pinModalActionRef.current = null;
    setPinModalOpen(false);
  };

  const handleAddPin = async (): Promise<boolean> => {
    const trimmedHandle = newPinHandle.trim();
    const pinPattern = /^[0-9]{4,12}$/;
    const errors: ApproverErrors = {};
    const existing = state.parentSettings.pins || [];

    if (!trimmedHandle) {
      errors.handle = 'Enter an approver handle';
    }
    if (!pinPattern.test(newPinCode)) {
      errors.pin = 'PIN must be 4-12 digits';
    }
    if (!pinPattern.test(newPinConfirm)) {
      errors.confirm = 'Confirm PIN using 4-12 digits';
    } else if (pinPattern.test(newPinCode) && newPinCode !== newPinConfirm) {
      errors.confirm = 'PINs must match';
    }

    if (Object.keys(errors).length > 0) {
      setApproverErrors(errors);
      return false;
    }

    setApproverErrors({});

    const attemptAdd = async (actorHandle?: string) => {
      try {
        const { genSalt, hashPin } = await import('../../utils/pinUtils');
        for (const entry of existing) {
          const hashed = await hashPin(newPinCode, entry.salt);
          if (hashed === entry.pinHash) {
            setApproverErrors(prev => ({ ...prev, pin: 'PIN already in use by another approver' }));
            return false;
          }
        }
        const salt = await genSalt();
        const pinHash = await hashPin(newPinCode, salt);
        const updated = [ ...existing.filter(p => p.handle !== trimmedHandle), { handle: trimmedHandle, pinHash, salt } ];
        dispatch({ type: 'UPDATE_PARENT_SETTINGS', payload: { pins: updated }, actorHandle });
        setNewPinHandle(''); setNewPinCode(''); setNewPinConfirm('');
        setApproverErrors({});
        showToast('Approver added', 'success');
        if (pendingApprovalKey) {
          dispatch({
            type: 'UPDATE_PARENT_SETTINGS',
            payload: { approvals: { ...state.parentSettings.approvals, [pendingApprovalKey]: true } },
            actorHandle
          });
          setPendingApprovalKey(null);
        }
        setShowAddApproverInline(false);
        return true;
      } catch (e) {
        console.error('pin add error', e);
        showAlert('Failed to add approver');
        return false;
      }
    };

    if (existing.length > 0) {
      requestPinVerification('Enter an existing parent PIN to add another approver.', (actorHandle) => {
        attemptAdd(actorHandle);
      });
      return false;
    }

    return attemptAdd();
  };

  const handleRemovePin = (handle: string) => {
    if (!confirm(`Remove approver ${handle}?`)) return;
    requestPinVerification('Enter a parent PIN to remove an approver.', (actorHandle) => {
      const existing = state.parentSettings.pins || [];
      const updated = existing.filter(p => p.handle !== handle);
      dispatch({ type: 'UPDATE_PARENT_SETTINGS', payload: { pins: updated }, actorHandle });
      showToast('Approver removed', 'info');
    });
  };

  const handleToggleApproval = (key: keyof typeof state.parentSettings.approvals, enabled: boolean) => {
    // Update local state only
    setLocalApprovals(prev => ({ ...prev, [key]: enabled }));
  };

  const handleSaveSettings = () => {
    // Check if any approvals changed
    const approvalsChanged = JSON.stringify(localApprovals) !== JSON.stringify(state.parentSettings.approvals);
    const voiceSettingsChanged = JSON.stringify(localVoiceSettings) !== JSON.stringify(state.parentSettings.voiceAnnouncements);
    
    if (approvalsChanged) {
      // Check if enabling any approval requires approvers
      const approvers = state.parentSettings.pins || [];
      const enablingApprovals = Object.keys(localApprovals).filter(
        key => localApprovals[key as keyof typeof localApprovals] && 
               !state.parentSettings.approvals[key as keyof typeof state.parentSettings.approvals]
      );
      
      if (enablingApprovals.length > 0 && approvers.length === 0) {
        showAlert('Enabling approval requirements requires at least one approver. Please add an approver first.');
        return;
      }
      
      // Save approval settings
      dispatch({
        type: 'UPDATE_PARENT_SETTINGS',
        payload: { approvals: localApprovals }
      });
    }
    
    if (voiceSettingsChanged) {
      // Save voice announcement settings
      dispatch({
        type: 'UPDATE_PARENT_SETTINGS',
        payload: { voiceAnnouncements: localVoiceSettings }
      });
    }
    
    if (approvalsChanged || voiceSettingsChanged) {
      showToast('Settings saved', 'success');
    }
    
    onClose();
  };

  const handleResetData = () => {
    setResetConfirmOpen(true);
  };

  const confirmResetData = () => {
    dispatch({ type: "RESET_ALL_DATA" });
  };

  const handleRestartTutorial = () => {
    dispatch({
      type: 'UPDATE_PARENT_SETTINGS',
      payload: {
        onboardingCompleted: false,
      },
    });
    showToast('Tutorial will restart when you close settings', 'info');
  };

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setAlertOpen(true);
  };

  const modalContent = (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Settings</h2>
          <span className="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>&times;</span>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>🔒 Parent Settings</h3>
            <div className="parent-settings">
              
              <div className="approval-settings">
                <h4>Require Parent Approval For:</h4>
                <label>
                  <input type="checkbox" checked={localApprovals.taskMove} onChange={(e) => handleToggleApproval('taskMove', e.target.checked)} /> Moving tasks between children
                </label>
                <label>
                  <input type="checkbox" checked={localApprovals.earlyComplete} onChange={(e) => handleToggleApproval('earlyComplete', e.target.checked)} /> Completing tasks early
                </label>
                <label>
                  <input type="checkbox" checked={localApprovals.taskComplete} onChange={(e) => handleToggleApproval('taskComplete', e.target.checked)} /> Marking any task complete
                </label>
                <label>
                  <input type="checkbox" checked={localApprovals.editTasks} onChange={(e) => handleToggleApproval('editTasks', e.target.checked)} /> Editing tasks and children
                </label>
              </div>
              <div className="approver-list" style={{ marginTop: 12 }}>
                <h4>Approvers</h4>
                {(!state.parentSettings.pins || state.parentSettings.pins.length === 0) ? (
                  <div className="empty-state">No approvers defined. Add one below.</div>
                ) : (
                  state.parentSettings.pins!.map(p => (
                    <div key={p.handle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>{p.handle}</div>
                      <div><button className="btn btn-small btn-danger" onClick={() => handleRemovePin(p.handle)}>Remove</button></div>
                    </div>
                  ))
                )}
                <div style={{ marginTop: 8 }} data-tour="approver-form">
                  <div style={{ marginBottom: 8 }}>
                    <input 
                      placeholder="Handle (e.g. Dad)" 
                      value={newPinHandle} 
                      onChange={e => { setNewPinHandle(e.target.value); clearApproverError('handle'); }} 
                      data-tour="approver-handle-input"
                      aria-invalid={approverErrors.handle ? 'true' : undefined}
                      style={{ width: '100%', marginBottom: 8 }}
                    />
                    {approverErrors.handle && <div className="input-error">{approverErrors.handle}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <input 
                        placeholder="PIN (4-12 digits)" 
                        type="password" 
                        minLength={4}
                        maxLength={12} 
                        value={newPinCode} 
                        onChange={e => { setNewPinCode(e.target.value); clearApproverError('pin'); }} 
                        data-tour="approver-pin-input"
                        aria-invalid={approverErrors.pin ? 'true' : undefined}
                        style={{ width: '120px' }}
                      />
                      {approverErrors.pin && <div className="input-error">{approverErrors.pin}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <input 
                        placeholder="Confirm PIN" 
                        type="password" 
                        minLength={4}
                        maxLength={12} 
                        value={newPinConfirm} 
                        onChange={e => { setNewPinConfirm(e.target.value); clearApproverError('confirm'); }} 
                        data-tour="approver-confirm-input"
                        aria-invalid={approverErrors.confirm ? 'true' : undefined}
                        style={{ width: '120px' }}
                      />
                      {approverErrors.confirm && <div className="input-error">{approverErrors.confirm}</div>}
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      onClick={handleAddPin} 
                      data-tour="add-approver-button"
                    >
                      Add Approver
                    </button>
                  </div>
                </div>
              </div>
            </div>
                {showAddApproverInline && (
                  <div className="modal" style={{ display: 'block' }}>
                    <div className="modal-content">
                      <div className="modal-header">
                        <h3>Add Approver</h3>
                        <span className="close" onClick={() => setShowAddApproverInline(false)}>&times;</span>
                      </div>
                      <div className="modal-body">
                        <div style={{ marginBottom: 8 }}>No approvers found — create the first approver to enable approval flows.</div>
                        <div style={{ marginBottom: 8 }}>
                          <input 
                            placeholder="Handle (e.g. Parent)" 
                            value={newPinHandle} 
                            onChange={e => { setNewPinHandle(e.target.value); clearApproverError('handle'); }} 
                            aria-invalid={approverErrors.handle ? 'true' : undefined}
                            style={{ width: '100%', marginBottom: 8 }}
                          />
                          {approverErrors.handle && <div className="input-error">{approverErrors.handle}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <input 
                              placeholder="PIN (4-12 digits)" 
                              type="password" 
                              minLength={4}
                              maxLength={12} 
                              value={newPinCode} 
                              onChange={e => { setNewPinCode(e.target.value); clearApproverError('pin'); }} 
                              aria-invalid={approverErrors.pin ? 'true' : undefined}
                              style={{ width: '120px' }}
                            />
                            {approverErrors.pin && <div className="input-error">{approverErrors.pin}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <input 
                              placeholder="Confirm PIN" 
                              type="password" 
                              minLength={4}
                              maxLength={12} 
                              value={newPinConfirm} 
                              onChange={e => { setNewPinConfirm(e.target.value); clearApproverError('confirm'); }} 
                              aria-invalid={approverErrors.confirm ? 'true' : undefined}
                              style={{ width: '120px' }}
                            />
                            {approverErrors.confirm && <div className="input-error">{approverErrors.confirm}</div>}
                          </div>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button className="btn btn-primary" onClick={async () => {
                          const success = await handleAddPin();
                          if (success) {
                            setShowAddApproverInline(false);
                          }
                        }}>Create Approver</button>
                        <button className="btn btn-secondary" onClick={() => setShowAddApproverInline(false)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
          </div>
                {/* Additional approver verification happens on demand via PIN modal */}

          <div className="settings-section">
            <h3>🔊 Voice Announcements</h3>
            <div className="parent-settings">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input 
                  type="checkbox" 
                  checked={localVoiceSettings.enabled} 
                  onChange={(e) => setLocalVoiceSettings(prev => ({ ...prev, enabled: e.target.checked }))} 
                /> 
                Enable voice announcements
              </label>
              
              {localVoiceSettings.enabled && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4 }}>Volume: {Math.round(localVoiceSettings.volume * 100)}%</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1" 
                      value={localVoiceSettings.volume} 
                      onChange={(e) => setLocalVoiceSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))} 
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4 }}>Speech Rate: {localVoiceSettings.rate.toFixed(1)}x</label>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2" 
                      step="0.1" 
                      value={localVoiceSettings.rate} 
                      onChange={(e) => setLocalVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))} 
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 8 }}>Timed Task Announcements</h4>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input 
                        type="checkbox" 
                        checked={localVoiceSettings.timerAnnouncements?.enabled ?? false} 
                        onChange={(e) => setLocalVoiceSettings(prev => ({ 
                          ...prev, 
                          timerAnnouncements: { 
                            ...prev.timerAnnouncements, 
                            enabled: e.target.checked,
                            announceAtPercentages: prev.timerAnnouncements?.announceAtPercentages || [0.5, 0.75, 0.9],
                            announceAtSecondsRemaining: prev.timerAnnouncements?.announceAtSecondsRemaining || [60, 30, 10],
                            announceAtStart: prev.timerAnnouncements?.announceAtStart ?? true,
                          } 
                        }))} 
                      /> 
                      Announce during timed tasks
                    </label>
                    {localVoiceSettings.timerAnnouncements?.enabled && (
                      <div style={{ marginLeft: 24, fontSize: '0.9rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <input 
                            type="checkbox" 
                            checked={localVoiceSettings.timerAnnouncements.announceAtStart ?? true} 
                            onChange={(e) => setLocalVoiceSettings(prev => ({ 
                              ...prev, 
                              timerAnnouncements: { 
                                ...prev.timerAnnouncements!, 
                                announceAtStart: e.target.checked 
                              } 
                            }))} 
                          /> 
                          Announce when timer starts
                        </label>
                        <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#666' }}>
                          Announcements at: {localVoiceSettings.timerAnnouncements.announceAtPercentages?.map(p => `${Math.round(p * 100)}%`).join(', ')} complete
                          {localVoiceSettings.timerAnnouncements.announceAtSecondsRemaining && 
                            ` and ${localVoiceSettings.timerAnnouncements.announceAtSecondsRemaining.map(s => `${s}s`).join(', ')} remaining`}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 8 }}>Scheduled Task Announcements</h4>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input 
                        type="checkbox" 
                        checked={localVoiceSettings.scheduledAnnouncements?.enabled ?? false} 
                        onChange={(e) => setLocalVoiceSettings(prev => ({ 
                          ...prev, 
                          scheduledAnnouncements: { 
                            ...prev.scheduledAnnouncements, 
                            enabled: e.target.checked,
                            announceMinutesBefore: prev.scheduledAnnouncements?.announceMinutesBefore || [15, 5],
                            announceAtDueTime: prev.scheduledAnnouncements?.announceAtDueTime ?? true,
                          } 
                        }))} 
                      /> 
                      Announce upcoming scheduled tasks
                    </label>
                    {localVoiceSettings.scheduledAnnouncements?.enabled && (
                      <div style={{ marginLeft: 24, fontSize: '0.9rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <input 
                            type="checkbox" 
                            checked={localVoiceSettings.scheduledAnnouncements.announceAtDueTime ?? true} 
                            onChange={(e) => setLocalVoiceSettings(prev => ({ 
                              ...prev, 
                              scheduledAnnouncements: { 
                                ...prev.scheduledAnnouncements!, 
                                announceAtDueTime: e.target.checked 
                              } 
                            }))} 
                          /> 
                          Announce when task is due
                        </label>
                        <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#666' }}>
                          Reminders: {localVoiceSettings.scheduledAnnouncements.announceMinutesBefore?.map(m => `${m} min`).join(', ')} before
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="settings-section">
            <h3>👥 Children</h3>
            <div>
              {state.children.length === 0 ? (
                <div className="empty-state">No children added yet. Add your first child below.</div>
              ) : (
                (() => {
                  // Ensure we have a complete order that includes all children
                  const existingOrder = state.parentSettings.childDisplayOrder || [];
                  const allChildIds = state.children.map(c => c.id);
                  
                  // Build complete order: use existing order, then add any missing children
                  const currentOrder = [
                    ...existingOrder.filter(id => allChildIds.includes(id)),
                    ...allChildIds.filter(id => !existingOrder.includes(id))
                  ];
                  
                  const orderedChildren = currentOrder
                    .map(id => state.children.find(c => c.id === id))
                    .filter((c): c is typeof state.children[0] => c !== undefined);
                  
                  return orderedChildren.map((child, index) => {
                    const canMoveUp = index > 0;
                    const canMoveDown = index < orderedChildren.length - 1;
                    
                    const handleMoveUp = () => {
                      const newOrder = [...currentOrder];
                      const currentIndex = newOrder.indexOf(child.id);
                      if (currentIndex > 0) {
                        [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
                        dispatch({
                          type: 'UPDATE_PARENT_SETTINGS',
                          payload: { childDisplayOrder: newOrder },
                        });
                      }
                    };
                    
                    const handleMoveDown = () => {
                      const newOrder = [...currentOrder];
                      const currentIndex = newOrder.indexOf(child.id);
                      if (currentIndex < newOrder.length - 1) {
                        [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
                        dispatch({
                          type: 'UPDATE_PARENT_SETTINGS',
                          payload: { childDisplayOrder: newOrder },
                        });
                      }
                    };
                    
                    return (
                      <div key={child.id} className="child-item">
                        <div className="child-info">
                          <span className="child-name">{child.name}</span>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>{child.blockchainAddress || <em>No address</em>}</div>
                        </div>
                        <div className="child-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {onEditChild && (
                            <button
                              className="btn btn-small"
                              onClick={() => onEditChild(child.id)}
                              title="Edit child"
                            >
                              Edit
                            </button>
                          )}
                          <button 
                            className="btn btn-small" 
                            onClick={handleMoveUp}
                            disabled={!canMoveUp}
                            title="Move up"
                            style={{ opacity: canMoveUp ? 1 : 0.5, cursor: canMoveUp ? 'pointer' : 'not-allowed' }}
                          >
                            ↑
                          </button>
                          <button 
                            className="btn btn-small" 
                            onClick={handleMoveDown}
                            disabled={!canMoveDown}
                            title="Move down"
                            style={{ opacity: canMoveDown ? 1 : 0.5, cursor: canMoveDown ? 'pointer' : 'not-allowed' }}
                          >
                            ↓
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => handleDeleteChild(child.id)}>Delete</button>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Child name"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Blockchain address / ENS (optional)"
                value={newChildBlockchain}
                onChange={(e) => setNewChildBlockchain(e.target.value)}
                style={{ marginLeft: 8 }}
              />
              <button className="btn btn-primary" onClick={handleAddChild}>Add Child</button>
            </div>
          </div>

          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>📝 Tasks</h3>
              <button className="btn btn-primary" onClick={onCreateTask}>+ New Task</button>
            </div>
            <div>
              {!state.tasks || state.tasks.length === 0 ? (
                <div className="empty-state">No tasks created yet. Use &quot;+ New Task&quot; for the full editor.</div>
              ) : (
                state.tasks.map((task) => {
                  const cadence = task.recurring?.cadence || 'custom';
                  const recurrenceDesc = task.type === 'oneoff' || task.oneOff
                    ? 'One-off'
                    : cadence;
                  return (
                    <div key={task.id} className="chore-item">
                      <div className="chore-info">
                        <span>{task.emoji || '📝'} {task.title}</span>
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>
                          ⭐ {task.stars || 0} | 💰 ${task.money || 0} | {recurrenceDesc}
                        </div>
                      </div>
                      <div className="chore-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-small" onClick={() => onEditTask(task.id)}>Edit</button>
                        <button className="btn btn-small btn-danger" onClick={() => handleDeleteChore(task.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSaveSettings}>Save Settings</button>
          <button className="btn btn-secondary" onClick={handleRestartTutorial}>Restart Tutorial</button>
          <button className="btn btn-danger" onClick={handleResetData}>Reset All Data</button>
        </div>
      </div>
        <AlertModal
          open={alertOpen}
          onClose={() => setAlertOpen(false)}
          title="Notice"
          message={alertMessage}
        />
        <ConfirmationModal
          open={resetConfirmOpen}
          onClose={() => setResetConfirmOpen(false)}
          onConfirm={confirmResetData}
          title="Reset All Data"
          message="Are you sure you want to reset all data? This cannot be undone. All children, tasks, and settings will be deleted."
          confirmText="Reset All Data"
          cancelText="Cancel"
          confirmButtonClass="btn btn-danger"
        />
      </div>
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite" aria-atomic="true">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}`}
              role="status"
            >
              <span>{toast.message}</span>
              {toast.dismissible && (
                <button
                  className="toast-close"
                  onClick={() => removeToast(toast.id)}
                  aria-label="Dismiss notification"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <PinModal
        open={pinModalOpen}
        onClose={handlePinModalClose}
        onSuccess={handlePinModalSuccess}
        message={pinModalMessage}
      />
    </>
  );

  return createPortal(modalContent, document.body);
}
