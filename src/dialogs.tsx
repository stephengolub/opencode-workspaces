import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { isLocal, relativeTime, wsName } from "./helpers.js"
import type { WsActions } from "./store.js"
import type { Workspace } from "./types.js"
import { STATUS_SYMBOL } from "./constants.js"

// ─── Individual workspace dialogs ─────────────────────────────────────────────

export function showCreateDialog(api: TuiPluginApi, actions: WsActions) {
  api.ui.dialog.replace(() => (
    <api.ui.DialogPrompt
      title="New workspace"
      placeholder="Branch name (optional, auto-generated if blank)"
      onConfirm={(name) => {
        api.ui.dialog.clear()
        actions.createWorkspace(name.trim() || undefined)
      }}
      onCancel={() => api.ui.dialog.clear()}
    />
  ))
}

export function showRenameDialog(api: TuiPluginApi, ws: Workspace, actions: WsActions) {
  api.ui.dialog.replace(() => (
    <api.ui.DialogPrompt
      title="Rename workspace"
      placeholder="Display name"
      value={wsName(ws, actions.store.names)}
      onConfirm={(name) => {
        api.ui.dialog.clear()
        if (name.trim()) actions.setName(ws.id, name.trim())
      }}
      onCancel={() => api.ui.dialog.clear()}
    />
  ))
}

export function showDeleteDialog(api: TuiPluginApi, ws: Workspace, actions: WsActions) {
  const name = wsName(ws, actions.store.names)
  api.ui.dialog.replace(() => (
    <api.ui.DialogConfirm
      title="Delete workspace"
      message={`Delete "${name}"?\n\nThis removes the git worktree and its branch. This cannot be undone.`}
      onConfirm={() => {
        api.ui.dialog.clear()
        if (ws.directory) actions.deleteWorkspace(ws.id, ws.directory)
      }}
      onCancel={() => api.ui.dialog.clear()}
    />
  ))
}

export function showResetDialog(api: TuiPluginApi, ws: Workspace, actions: WsActions) {
  const name = wsName(ws, actions.store.names)
  api.ui.dialog.replace(() => (
    <api.ui.DialogConfirm
      title="Reset workspace"
      message={`Reset "${name}"?\n\nHard-resets branch to default. Uncommitted changes are lost and sessions archived.`}
      onConfirm={() => {
        api.ui.dialog.clear()
        if (ws.directory) actions.resetWorkspace(ws.id, ws.directory)
      }}
      onCancel={() => api.ui.dialog.clear()}
    />
  ))
}

export function showSwitchDialog(api: TuiPluginApi, actions: WsActions) {
  const options = actions.store.workspaces.map((ws) => {
    const status = actions.store.statuses[ws.id] ?? "disconnected"
    const sym = STATUS_SYMBOL[status] ?? "○"
    return {
      title: `${sym} ${wsName(ws, actions.store.names)}`,
      value: ws.id,
      description: `${isLocal(ws) ? "local" : "sandbox"} · ${ws.branch ?? ""}`,
    }
  })
  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="Switch workspace"
      options={options}
      current={actions.store.currentID}
      onSelect={(opt) => {
        api.ui.dialog.clear()
        actions.setCurrent(opt.value as string)
      }}
    />
  ))
}

// ─── Session browser ──────────────────────────────────────────────────────────

export function showSessionsDialog(api: TuiPluginApi, actions: WsActions) {
  const store = actions.store

  function wsLabel(ws: Workspace, isCurrent: boolean): string {
    const type = isLocal(ws) ? "local" : "sandbox"
    const name = wsName(ws, store.names)
    return isCurrent ? `◀ ${type} : ${name}` : `${type} : ${name}`
  }

  // Determine display order: current first, then local, then remaining sandboxes
  const current = store.workspaces.find((w) => w.id === store.currentID)
  const orderedWs: Workspace[] = []
  if (current) orderedWs.push(current)
  const local = store.workspaces.find((w) => isLocal(w) && w.id !== current?.id)
  if (local) orderedWs.push(local)
  for (const ws of store.workspaces) {
    if (ws.id !== current?.id && !isLocal(ws)) orderedWs.push(ws)
  }

  type Opt = { title: string; value: string; category: string; description?: string }
  const options: Opt[] = []

  for (const ws of orderedWs) {
    const category = wsLabel(ws, ws.id === current?.id)
    const wsSessions = isLocal(ws)
      ? store.sessions.filter((s) => !s.workspaceID || s.workspaceID === ws.id)
      : store.sessions.filter((s) => s.workspaceID === ws.id)
    for (const s of wsSessions) {
      options.push({
        title: s.title || s.slug || s.id.slice(0, 8),
        value: s.id,
        category,
        description: s.time?.updated ? relativeTime(s.time.updated) : undefined,
      })
    }
  }

  // Sessions with unrecognized workspaceIDs
  const knownIds = new Set(store.workspaces.map((w) => w.id))
  for (const s of store.sessions) {
    if (s.workspaceID && !knownIds.has(s.workspaceID)) {
      options.push({
        title: s.title || s.slug || s.id.slice(0, 8),
        value: s.id,
        category: "other",
        description: s.time?.updated ? relativeTime(s.time.updated) : undefined,
      })
    }
  }

  if (options.length === 0) {
    api.ui.toast({ variant: "info", message: "No sessions found" })
    return
  }

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="Sessions"
      options={options}
      onSelect={(opt) => {
        api.ui.dialog.clear()
        api.route.navigate("session", { sessionID: opt.value })
      }}
    />
  ))
}

// ─── Workspace sub-picker menu ────────────────────────────────────────────────

export type WsMenuValue =
  | "new" | "switch" | "session" | "sessions" | "manage"
  | "rename" | "reset" | "delete" | "toggle"

export function showWsMenu(api: TuiPluginApi, actions: WsActions) {
  const store = actions.store
  const current = store.workspaces.find((w) => w.id === store.currentID)
  const isSandbox = current && !isLocal(current)
  const currentLabel = current ? wsName(current, store.names) : undefined

  const options: Array<{
    title: string
    value: WsMenuValue
    description?: string
    disabled?: boolean
  }> = [
    {
      title: "New workspace",
      value: "new",
      description: "Create a git worktree on a new branch",
      disabled: !store.enabled,
    },
    {
      title: "Switch workspace",
      value: "switch",
      description: store.workspaces.length > 1
        ? `Currently: ${currentLabel ?? "none"}`
        : "No other workspaces to switch to",
      disabled: !store.enabled || store.workspaces.length <= 1,
    },
    {
      title: "New session",
      value: "session",
      description: currentLabel ? `In ${currentLabel}` : "Select a workspace first",
      disabled: !store.enabled || !store.currentID,
    },
    {
      title: "Browse sessions",
      value: "sessions",
      description: store.sessions.length > 0
        ? `${store.sessions.length} sessions across workspaces`
        : "No sessions yet",
      disabled: !store.enabled || store.sessions.length === 0,
    },
    {
      title: "Manage workspaces",
      value: "manage",
      description: "Full list, rename, reset, delete",
      disabled: !store.enabled,
    },
    {
      title: "Rename workspace",
      value: "rename",
      description: isSandbox ? `Rename "${currentLabel}"` : "Only available for sandbox workspaces",
      disabled: !isSandbox,
    },
    {
      title: "Reset workspace",
      value: "reset",
      description: isSandbox
        ? `Hard-reset "${currentLabel}" to default branch`
        : "Only available for sandbox workspaces",
      disabled: !isSandbox,
    },
    {
      title: "Delete workspace",
      value: "delete",
      description: isSandbox ? `Remove "${currentLabel}" worktree` : "Only available for sandbox workspaces",
      disabled: !isSandbox,
    },
    {
      title: store.enabled ? "Disable workspaces" : "Enable workspaces",
      value: "toggle",
      description: store.enabled
        ? "Collapse back to flat session list"
        : "Show multiple worktrees in sidebar",
    },
  ]

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="Workspaces"
      options={options}
      onSelect={async (opt) => {
        api.ui.dialog.clear()
        const val = opt.value as WsMenuValue
        if (val === "new") {
          showCreateDialog(api, actions)
        } else if (val === "switch") {
          showSwitchDialog(api, actions)
        } else if (val === "session") {
          const session = await actions.createSession()
          if (session) api.route.navigate("session", { sessionID: session.id })
        } else if (val === "sessions") {
          showSessionsDialog(api, actions)
        } else if (val === "manage") {
          api.route.navigate("workspaces")
        } else if (val === "rename" && current) {
          showRenameDialog(api, current, actions)
        } else if (val === "reset" && current) {
          showResetDialog(api, current, actions)
        } else if (val === "delete" && current) {
          showDeleteDialog(api, current, actions)
        } else if (val === "toggle") {
          const next = !store.enabled
          actions.setEnabled(next)
          api.ui.toast({
            variant: "info",
            message: next
              ? "Workspaces enabled — Multiple worktrees shown in sidebar"
              : "Workspaces disabled",
          })
        }
      }}
    />
  ))
}
