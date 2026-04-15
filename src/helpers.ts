import type { Workspace } from "./types.ts"

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function wsName(ws: Workspace, names: Record<string, string>): string {
  return names[ws.id] ?? ws.name ?? ws.branch ?? ws.id
}

export function isLocal(ws: Workspace): boolean {
  return ws.type === "local"
}

export function shortDir(dir: string | null | undefined): string {
  if (!dir) return ""
  const home = process.env.HOME ?? ""
  return home ? dir.replace(home, "~") : dir
}

export function relativeTime(epochSeconds: number): string {
  const diffMs = Date.now() - epochSeconds * 1000
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  const d = new Date(epochSeconds * 1000)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
