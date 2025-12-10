export interface ActionLogEntry {
  id: string;
  actionType: string;
  payload?: unknown; // Use unknown instead of any for type safety
  actorHandle?: string | null; // optional handle associated with a PIN or user
  timestamp: string; // ISO
}

export default ActionLogEntry;
