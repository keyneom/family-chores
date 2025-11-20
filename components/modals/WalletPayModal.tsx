import React from "react";
import { Child } from "../ChoresAppContext";
import { useAccount, useConnect, useNetwork, useSwitchNetwork, useWalletClient } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { parseEther, parseUnits } from 'viem';

interface WalletPayModalProps {
  open: boolean;
  onClose: () => void;
  child: Child;
  defaultAmount?: number; // in app money units; ChildColumn passes the current balance
}

// Minimal ERC20 ABI for transfer
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export default function WalletPayModal({ open, onClose, child, defaultAmount = 0 }: WalletPayModalProps) {
  const { address } = useAccount();
  const { connectAsync } = useConnect();
  const { chain } = useNetwork();
  const { switchNetwork: wagmiSwitchNetwork } = useSwitchNetwork();
  const { data: walletClient } = useWalletClient();
  const [connectedAddress, setConnectedAddress] = React.useState<string | null>(null);
  // Default to the child's current owed balance so the modal zeros them out by default
  const [amount, setAmount] = React.useState<string>(defaultAmount ? String(defaultAmount) : "0.01");
  const [token, setToken] = React.useState<"ETH" | "USDC">("ETH");
  const [status, setStatus] = React.useState<string | null>(null);
  const [chainId, setChainId] = React.useState<number>(1);

  React.useEffect(() => {
    // reset when open toggles
    if (!open) {
      setStatus(null);
      setAmount(defaultAmount ? String(defaultAmount) : "0.01");
    }
  }, [open, defaultAmount]);

  const connect = async () => {
    try {
        const win = window as unknown as { ethereum?: unknown };
        if (!win.ethereum) {
          setStatus("No web3 wallet found");
          return;
        }
        // Use wagmi to prompt connection
        const res = await connectAsync({ connector: new InjectedConnector() });
        const r = res as unknown as { account?: string; chain?: { id?: number } };
        const addr = r?.account || address;
        if (addr) setConnectedAddress(String(addr));
        setChainId(r?.chain?.id || chain?.id || 1);
        setStatus("Connected: " + (addr || ""));
    } catch (err: unknown) {
      const e = err as { message?: unknown };
      setStatus("Connect error: " + String(e?.message || String(err)));
    }
  };

  const switchNetwork = async (targetChainId: number) => {
    const win = window as unknown as { ethereum?: unknown };
    if (!win.ethereum) return setStatus("No wallet");
    try {
      if (wagmiSwitchNetwork) {
        wagmiSwitchNetwork(targetChainId);
        setStatus("Switched network");
        setChainId(targetChainId);
      } else {
        // fallback to direct RPC request
        const win = window as unknown as { ethereum?: unknown };
        const eth = win.ethereum as unknown as { request?: (...args: unknown[]) => Promise<unknown> };
        if (eth.request) {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + targetChainId.toString(16) }],
          });
        }
        setStatus("Switched network");
        setChainId(targetChainId);
      }
    } catch (err: unknown) {
      const e = err as { message?: unknown };
      setStatus("Switch error: " + String(e?.message || String(err)));
    }
  };

  const sendPayment = async () => {
    if (!walletClient) return setStatus("Please connect your wallet first");
    if (!child.blockchainAddress) return setStatus("Child has no blockchain address set in Settings");
    try {
      setStatus("Preparing transaction...");
      if (token === "ETH") {
        const value = parseEther(amount || "0");
        if (!walletClient?.sendTransaction) return setStatus("Wallet client can't send transactions");
        const txHash = await walletClient.sendTransaction({ to: child.blockchainAddress as `0x${string}`, value });
        setStatus("Sent. Transaction hash: " + String(txHash));
      } else {
        const usdcAddressByChain: Record<number, string | undefined> = {
          1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          42161: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
          // Base mainnet USDC (added from CoinGecko platforms mapping)
          8453: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        };
        const tokenAddress = usdcAddressByChain[chainId];
        if (!tokenAddress) return setStatus("USDC not configured for this network");
        const decimals = 6; // USDC standard
        const unitAmount = parseUnits(amount || "0", decimals);
        if (!walletClient?.writeContract) return setStatus("Wallet client can't write contracts");
        const txHash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI as unknown as readonly string[],
          functionName: 'transfer',
          args: [child.blockchainAddress as `0x${string}`, unitAmount],
        });
        setStatus("USDC transfer submitted: " + String(txHash));
      }
    } catch (err: unknown) {
      const e = err as { message?: unknown };
      setStatus("Send error: " + String(e?.message || String(err)));
    }
  };

  if (!open) return null;

  return (
    <div className="modal" style={{ display: "block" }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Pay {child.name} On-Chain</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          <div className="input-group">
            <label>Child address / ENS:</label>
            <div>{child.blockchainAddress || <em>Not set</em>}</div>
          </div>
          <div className="input-group">
            <label>Token:</label>
            <select value={token} onChange={(e) => setToken(e.target.value as unknown as "ETH" | "USDC") }>
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
          <div className="input-group">
            <label>Amount ({token === "ETH" ? "ETH" : "USDC"}):</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Network:</label>
            <select value={chainId} onChange={(e) => switchNetwork(Number(e.target.value))}>
              <option value={1}>Ethereum Mainnet</option>
              <option value={42161}>Arbitrum One</option>
              <option value={8453}>Base</option>
            </select>
          </div>
          <div className="wallet-controls">
            {connectedAddress ? (
              <div>Connected: {connectedAddress}</div>
            ) : (
              <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={sendPayment}>Send Payment</button>
            <button className="btn" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
          {status && <div style={{ marginTop: 12 }}>{status}</div>}
        </div>
      </div>
    </div>
  );
}
