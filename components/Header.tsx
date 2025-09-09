import React from "react";
import DateDisplay from "./DateDisplay";

interface HeaderProps {
  onSettingsClick?: () => void;
  onSyncClick?: () => void;
}

export default function Header({ onSettingsClick, onSyncClick }: HeaderProps) {
  return (
    <header>
      <h1>🏠 Family Chores</h1>
      <div className="header-controls">
        <div className="date-display">
          <DateDisplay />
        </div>
        <button id="settingsBtn" className="btn btn-primary" onClick={onSettingsClick}>
          ⚙️ Settings
        </button>
        <button id="syncBtn" className="btn btn-secondary" onClick={onSyncClick}>
          📱 Sync
        </button>
      </div>
    </header>
  );
}
