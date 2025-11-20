import React from "react";
import DateDisplay from "./DateDisplay";
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';

// Helper to detect user-rejected errors from wallets
function isUserRejectedError(err: unknown) {
  if (!err) return false;
  const maybe = err as { message?: unknown; name?: unknown };
  const msg = String(maybe.message ?? String(err ?? '')).toLowerCase();
  if (msg.includes('user rejected') || msg.includes('user rejected the request')) return true;
  if (typeof maybe.name === 'string' && maybe.name.toLowerCase().includes('userrejected')) return true;
  return false;
}

interface HeaderProps {
  onSettingsClick?: () => void;
  onSyncClick?: () => void;
}

export default function Header({ onSettingsClick, onSyncClick }: HeaderProps) {
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();

  const [connectError, setConnectError] = React.useState<string | null>(null);

  const handleConnect = async () => {
    setConnectError(null);
    try {
      await connectAsync({ connector: new InjectedConnector() });
    } catch (err: unknown) {
      // Friendly handling for user-rejected requests
      if (isUserRejectedError(err)) {
        setConnectError('Connection request rejected by wallet. Please approve the connection in your wallet.');
        return;
      }
      console.error('Connect failed', err);
      const e = err as { message?: unknown };
      setConnectError(String(e?.message || String(err)));
    }
  };

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
        <div style={{ marginLeft: 12 }}>
          {isConnected ? (
            <button className="btn btn-wallet" onClick={() => disconnect()} title={address || ''}>
              {address ? `${String(address).slice(0,6)}...${String(address).slice(-4)}` : 'Wallet'}
            </button>
          ) : (
            <button className="btn btn-wallet" onClick={handleConnect}>
              Connect Wallet
            </button>
          )}
          {connectError && <div style={{ color: '#c00', fontSize: '0.8rem', marginTop: 4 }}>{connectError}</div>}
        </div>
      </div>
    </header>
  );
}
