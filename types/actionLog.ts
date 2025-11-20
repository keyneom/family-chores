export interface ActionLogEntry {
  id: string;
  actionType: string;
  payload?: any;
  actorHandle?: string | null; // optional handle associated with a PIN or user
  timestamp: string; // ISO
}

export default ActionLogEntry;
