import React, { useState } from "react";
import { useChoresApp } from "../ChoresAppContext";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { state, dispatch } = useChoresApp();
  const [newChildName, setNewChildName] = useState("");
  const [newChoreName, setNewChoreName] = useState("");
  const [newChoreEmoji, setNewChoreEmoji] = useState("");
  const [newChoreColor, setNewChoreColor] = useState("#FFB6C1");
  const [newChoreStars, setNewChoreStars] = useState(1);
  const [newChoreMoney, setNewChoreMoney] = useState(0.5);
  const [choreRecurrence, setChoreRecurrence] = useState("daily");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  if (!open) return null;

  const handleAddChild = () => {
    if (newChildName.trim()) {
      dispatch({
        type: "ADD_CHILD",
        payload: {
          id: Date.now(),
          name: newChildName.trim(),
          stars: 0,
          money: 0
        }
      });
      setNewChildName("");
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

  const handleSavePin = () => {
    if (newPin !== confirmPin) {
      alert("PINs do not match");
      return;
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      alert("PIN must be exactly 4 digits");
      return;
    }
    if (state.parentSettings.pin && currentPin !== state.parentSettings.pin) {
      alert("Current PIN is incorrect");
      return;
    }
    
    dispatch({
      type: "UPDATE_PARENT_SETTINGS",
      payload: { pin: newPin }
    });
    
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    alert("PIN updated successfully");
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
              <div className="input-group">
                <label htmlFor="currentPin">Current PIN:</label>
                <input
                  type="password"
                  id="currentPin"
                  placeholder="Current PIN"
                  maxLength={4}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="newPin">New PIN (4 digits):</label>
                <input
                  type="password"
                  id="newPin"
                  placeholder="New 4-digit PIN"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="confirmPin">Confirm New PIN:</label>
                <input
                  type="password"
                  id="confirmPin"
                  placeholder="Confirm PIN"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={handleSavePin}>Change PIN</button>
              </div>
              <div className="approval-settings">
                <h4>Require Parent Approval For:</h4>
                <label><input type="checkbox" /> Moving tasks between children</label>
                <label><input type="checkbox" /> Completing tasks early</label>
                <label><input type="checkbox" /> Marking any task complete</label>
                <label><input type="checkbox" /> Editing tasks and children</label>
              </div>
            </div>
          </div>

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
