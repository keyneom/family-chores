import React, { useState } from "react";
import { useChoresApp } from "../ChoresAppContext";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { state, dispatch } = useChoresApp();
  const [newChildName, setNewChildName] = useState("");
  const [newChildBlockchain, setNewChildBlockchain] = useState("");
  const [newChoreName, setNewChoreName] = useState("");
  const [newChoreEmoji, setNewChoreEmoji] = useState("");
  const [newChoreColor, setNewChoreColor] = useState("#FFB6C1");
  const [newChoreStars, setNewChoreStars] = useState(1);
  const [newChoreMoney, setNewChoreMoney] = useState(0.5);
  const [choreRecurrence, setChoreRecurrence] = useState("daily");
  const [customDays, setCustomDays] = useState<number[]>([]);
  // Legacy single PIN removed. Approvers are managed via `pins` below.
  const [newPinHandle, setNewPinHandle] = useState("");
  const [newPinCode, setNewPinCode] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [verifyExistingHandle, setVerifyExistingHandle] = useState("");
  const [verifyExistingPin, setVerifyExistingPin] = useState("");
  const [showAddApproverInline, setShowAddApproverInline] = useState(false);
  const [pendingApprovalKey, setPendingApprovalKey] = useState<null | keyof typeof state.parentSettings.approvals>(null);

  if (!open) return null;

  const handleAddChild = () => {
    if (newChildName.trim()) {
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
    }
  };

  const handleAddChore = () => {
    if (newChoreName.trim()) {
      const chore = {
        id: Date.now(),
        name: newChoreName.trim(),
        emoji: newChoreEmoji || "📝",
        color: newChoreColor,
        stars: newChoreStars,
        money: newChoreMoney,
        recurrence: choreRecurrence,
        customDays: choreRecurrence === "custom-days" ? customDays : undefined
      };
      dispatch({ type: "ADD_CHORE_TEMPLATE", payload: chore });
      setNewChoreName("");
      setNewChoreEmoji("");
      setNewChoreColor("#FFB6C1");
      setNewChoreStars(1);
      setNewChoreMoney(0.5);
      setChoreRecurrence("daily");
      setCustomDays([]);
    }
  };

  const handleDeleteChild = (childId: number) => {
    dispatch({ type: "DELETE_CHILD", payload: childId });
  };

  const handleDeleteChore = (choreId: number) => {
    dispatch({ type: "DELETE_CHORE_TEMPLATE", payload: choreId });
  };

  const handleCustomDayChange = (day: number, checked: boolean) => {
    if (checked) {
      setCustomDays([...customDays, day]);
    } else {
      setCustomDays(customDays.filter(d => d !== day));
    }
  };

  // legacy single PIN removed — no handler

  const handleAddPin = async () => {
    if (!newPinHandle.trim()) return alert('Enter a handle');
    if (newPinCode !== newPinConfirm) return alert('PINs do not match');
    if (!/^[0-9]{4}$/.test(newPinCode)) return alert('PIN must be 4 digits');
    const existing = state.parentSettings.pins || [];
    const proceedToAdd = async () => {
      try {
        const { genSalt, hashPin } = await import('../../utils/pinUtils');
        const salt = await genSalt();
        const pinHash = await hashPin(newPinCode, salt);
        const updated = [ ...existing.filter(p => p.handle !== newPinHandle.trim()), { handle: newPinHandle.trim(), pinHash, salt } ];
        dispatch({ type: 'UPDATE_PARENT_SETTINGS', payload: { pins: updated } });
        setNewPinHandle(''); setNewPinCode(''); setNewPinConfirm('');
        alert('Approver added');
      } catch (e) {
        console.error('pin add error', e);
        alert('Failed to add approver');
      }
    };

    if (existing.length > 0) {
      // require verification using an existing approver before adding a new one
      if (!verifyExistingHandle) return alert('Select an existing approver to authorize this change');
      if (!/^[0-9]{4}$/.test(verifyExistingPin)) return alert('Enter current approver PIN (4 digits)');
      try {
        const { hashPin } = await import('../../utils/pinUtils');
        const chosen = existing.find(p => p.handle === verifyExistingHandle);
        if (!chosen) return alert('Selected approver not found');
        const h = await hashPin(verifyExistingPin, chosen.salt);
        if (h !== chosen.pinHash) return alert('Existing approver PIN is incorrect');
        await proceedToAdd();
        // if we were opening the inline modal to enable a specific approval, enable it now
        if (pendingApprovalKey) {
          dispatch({ type: 'UPDATE_PARENT_SETTINGS', payload: { approvals: { ...state.parentSettings.approvals, [pendingApprovalKey]: true } } });
          setPendingApprovalKey(null);
        }
      } catch (e) {
        console.error('verify error', e);
        alert('Verification failed');
      }
    } else {
      await proceedToAdd();
      if (pendingApprovalKey) {
        dispatch({ type: 'UPDATE_PARENT_SETTINGS', payload: { approvals: { ...state.parentSettings.approvals, [pendingApprovalKey]: true } } });
        setPendingApprovalKey(null);
      }
    }
  };

  const handleRemovePin = (handle: string) => {
    if (!confirm(`Remove approver ${handle}?`)) return;
    const existing = state.parentSettings.pins || [];
    const updated = existing.filter(p => p.handle !== handle);
    dispatch({ type: 'UPDATE_PARENT_SETTINGS', payload: { pins: updated } });
  };

  const handleToggleApproval = (key: keyof typeof state.parentSettings.approvals, enabled: boolean) => {
    const approvers = state.parentSettings.pins || [];
    if (enabled && approvers.length === 0) {
      // Open inline add-approver prompt so the user can create the first approver now
      setPendingApprovalKey(key);
      setShowAddApproverInline(true);
      return;
    }
    dispatch({ type: 'UPDATE_PARENT_SETTINGS', payload: { approvals: { ...state.parentSettings.approvals, [key]: enabled } } });
  };

  const handleSaveSettings = () => {
    // Save any pending settings
    onClose();
  };

  const handleResetData = () => {
    if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
      dispatch({ type: "RESET_ALL_DATA" });
    }
  };

  return (
    <div className="modal" style={{ display: "block" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>⚙️ Settings</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h3>🔒 Parent Settings</h3>
            <div className="parent-settings">
              
              <div className="approval-settings">
                <h4>Require Parent Approval For:</h4>
                <label>
                  <input type="checkbox" checked={state.parentSettings.approvals.taskMove} onChange={(e) => handleToggleApproval('taskMove', e.target.checked)} /> Moving tasks between children
                </label>
                <label>
                  <input type="checkbox" checked={state.parentSettings.approvals.earlyComplete} onChange={(e) => handleToggleApproval('earlyComplete', e.target.checked)} /> Completing tasks early
                </label>
                <label>
                  <input type="checkbox" checked={state.parentSettings.approvals.taskComplete} onChange={(e) => handleToggleApproval('taskComplete', e.target.checked)} /> Marking any task complete
                </label>
                <label>
                  <input type="checkbox" checked={state.parentSettings.approvals.editTasks} onChange={(e) => handleToggleApproval('editTasks', e.target.checked)} /> Editing tasks and children
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
                <div style={{ marginTop: 8 }}>
                  <input placeholder="Handle (e.g. Dad)" value={newPinHandle} onChange={e => setNewPinHandle(e.target.value)} />
                    <input placeholder="PIN" type="password" maxLength={4} style={{ marginLeft: 8 }} value={newPinCode} onChange={e => setNewPinCode(e.target.value)} />
                    <input placeholder="Confirm" type="password" maxLength={4} style={{ marginLeft: 8 }} value={newPinConfirm} onChange={e => setNewPinConfirm(e.target.value)} />
                    <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={handleAddPin}>Add Approver</button>
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
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input placeholder="Handle (e.g. Parent)" value={newPinHandle} onChange={e => setNewPinHandle(e.target.value)} />
                          <input placeholder="PIN" type="password" maxLength={4} value={newPinCode} onChange={e => setNewPinCode(e.target.value)} />
                          <input placeholder="Confirm" type="password" maxLength={4} value={newPinConfirm} onChange={e => setNewPinConfirm(e.target.value)} />
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button className="btn btn-primary" onClick={async () => {
                          await handleAddPin();
                          // if added, close inline modal and enable all approvals unchecked (user can toggle)
                          setShowAddApproverInline(false);
                        }}>Create Approver</button>
                        <button className="btn btn-secondary" onClick={() => setShowAddApproverInline(false)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
          </div>
                  {state.parentSettings.pins && state.parentSettings.pins.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ marginBottom: 6 }}>To add a new approver, enter an existing approver handle and PIN to authorize this change.</div>
                      <select value={verifyExistingHandle} onChange={e => setVerifyExistingHandle(e.target.value)}>
                        <option value="">-- Select approver --</option>
                        {state.parentSettings.pins!.map(p => (
                          <option key={p.handle} value={p.handle}>{p.handle}</option>
                        ))}
                      </select>
                      <input type="password" placeholder="Existing approver PIN" maxLength={4} style={{ marginLeft: 8 }} value={verifyExistingPin} onChange={e => setVerifyExistingPin(e.target.value)} />
                    </div>
                  )}

          <div className="settings-section">
            <h3>👥 Children</h3>
            <div>
              {state.children.length === 0 ? (
                <div className="empty-state">No children added yet. Add your first child below.</div>
              ) : (
                state.children.map((child) => (
                  <div key={child.id} className="child-item">
                    <div className="child-info">
                      <span className="child-name">{child.name}</span>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{child.blockchainAddress || <em>No address</em>}</div>
                    </div>
                    <div className="child-actions">
                      <button className="btn btn-small btn-danger" onClick={() => handleDeleteChild(child.id)}>Delete</button>
                    </div>
                  </div>
                ))
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
            <h3>📝 Chores</h3>
            <div>
              {!state.choreTemplates || state.choreTemplates.length === 0 ? (
                <div className="empty-state">No chore templates created yet. Add your first chore below.</div>
              ) : (
                state.choreTemplates.map((chore) => (
                  <div key={chore.id} className="chore-item">
                    <div className="chore-info">
                      <span>{chore.emoji} {chore.name}</span>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>
                        ⭐ {chore.stars} | 💰 ${chore.money} | {chore.recurrence}
                      </div>
                    </div>
                    <div className="chore-actions">
                      <button className="btn btn-small btn-danger" onClick={() => handleDeleteChore(chore.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="add-chore-form">
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Chore name"
                  value={newChoreName}
                  onChange={(e) => setNewChoreName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Emoji"
                  maxLength={2}
                  value={newChoreEmoji}
                  onChange={(e) => setNewChoreEmoji(e.target.value)}
                />
                <input
                  type="color"
                  value={newChoreColor}
                  onChange={(e) => setNewChoreColor(e.target.value)}
                />
              </div>
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Stars"
                  min={1}
                  max={5}
                  value={newChoreStars}
                  onChange={(e) => setNewChoreStars(Number(e.target.value))}
                />
                <input
                  type="number"
                  placeholder="Money ($)"
                  min={0}
                  step={0.25}
                  value={newChoreMoney}
                  onChange={(e) => setNewChoreMoney(Number(e.target.value))}
                />
              </div>
              <div className="recurrence-group">
                <label htmlFor="choreRecurrence">Repeat:</label>
                <select
                  id="choreRecurrence"
                  value={choreRecurrence}
                  onChange={(e) => setChoreRecurrence(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekdays">Weekdays Only</option>
                  <option value="weekends">Weekends Only</option>
                  <option value="custom-days">Specific Days</option>
                </select>
              </div>
              {choreRecurrence === "custom-days" && (
                <div className="custom-days">
                  <label>Select days:</label>
                  <div className="days-checkboxes">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                      <label key={index}>
                        <input
                          type="checkbox"
                          checked={customDays.includes(index)}
                          onChange={(e) => handleCustomDayChange(index, e.target.checked)}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button className="btn btn-primary" onClick={handleAddChore}>Add Chore</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSaveSettings}>Save Settings</button>
          <button className="btn btn-danger" onClick={handleResetData}>Reset All Data</button>
        </div>
      </div>
    </div>
  );
}
