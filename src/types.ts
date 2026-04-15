import type { Session, Workspace } from "@opencode-ai/sdk/v2"

// Re-export for convenience
export type { Session, Workspace }

// ─── State ───────────────────────────────────────────────────────────────────

export interface WsState {
  enabled: boolean
  workspaces: Workspace[]
  statuses: Record<string, string>
  currentID: string | undefined
  currentDirectory: string
  projectRootDir: string
  sessionCounts: Record<string, number>
  sessions: Session[]
  sessionWorkspaceMap: Record<string, string>
  loading: boolean
  creating: boolean
  error: string | undefined
  busy: Record<string, boolean>
  names: Record<string, string>
}

// ─── Actions (resolved after createWsStore is defined) ───────────────────────

// Defined as the return type of createWsStore in store.ts
// Imported back here via the store module to avoid circular deps.
// External consumers should import WsActions from ./store.

// ─── Menu values ─────────────────────────────────────────────────────────────

export type WsMenuValue =
  | "new"
  | "switch"
  | "session"
  | "sessions"
  | "manage"
  | "rename"
  | "reset"
  | "delete"
  | "toggle"
