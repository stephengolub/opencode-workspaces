// ─── Constants ────────────────────────────────────────────────────────────────

export const KV = {
  enabled: "workspace_tui:enabled",
  current: "workspace_tui:current",
  names: "workspace_tui:names",
} as const

export const STATUS_SYMBOL: Record<string, string> = {
  connected: "●",
  connecting: "◐",
  disconnected: "○",
  error: "✕",
}
