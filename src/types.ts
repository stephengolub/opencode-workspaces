import type { Session, Workspace } from "@opencode-ai/sdk/v2"

// Re-export for convenience
export type { Session, Workspace }

// ─── State ───────────────────────────────────────────────────────────────────

export interface WsState {
  workspaces: Workspace[]
  statuses: Record<string, string>
  currentID: string | undefined
  currentDirectory: string
  projectRootDir: string
  sessionCounts: Record<string, number>
  sessions: Session[]
  sessionWorkspaceMap: Record<string, string>
  loading: boolean
  names: Record<string, string>
}
