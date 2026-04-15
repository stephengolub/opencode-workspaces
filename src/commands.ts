import type { TuiPluginApi, TuiCommand } from "@opencode-ai/plugin/tui"
import {
  showCreateDialog,
  showDeleteDialog,
  showRenameDialog,
  showResetDialog,
  showSessionsDialog,
  showSwitchDialog,
  showWsMenu,
} from "./dialogs.tsx"
import { isLocal, wsName } from "./helpers.ts"
import type { WsActions } from "./store.ts"

// ─── Command factory ──────────────────────────────────────────────────────────

/**
 * Build the full list of workspace commands for the command palette.
 * Called reactively — must only access reactive store values directly.
 */
export function buildCommands(api: TuiPluginApi, actions: WsActions): TuiCommand[] {
  const store = actions.store
  const current = store.workspaces.find((w) => w.id === store.currentID)
  const isSandbox = current && !isLocal(current)

  const sessionTitle = (() => {
    if (!store.currentID) return "New session in workspace"
    const ws = store.workspaces.find((w) => w.id === store.currentID) ?? store.workspaces[0]
    if (!ws) return "New session in workspace"
    return `New session in ${wsName(ws, store.names)}`
  })()

  return [
    {
      title: "Workspaces",
      value: "workspace.menu",
      category: "Workspace",
      description: "New, switch, manage, session and more",
      slash: { name: "ws", aliases: ["workspace"] },
      onSelect() {
        showWsMenu(api, actions)
      },
    },
    {
      title: store.enabled ? "Disable workspaces" : "Enable workspaces",
      value: "workspace.toggle",
      category: "Workspace",
      onSelect() {
        const next = !store.enabled
        actions.setEnabled(next)
        api.ui.toast({
          variant: "info",
          message: next
            ? "Workspaces enabled — Multiple worktrees shown in sidebar"
            : "Workspaces disabled",
        })
      },
    },
    {
      title: "New workspace",
      value: "workspace.new",
      category: "Workspace",
      enabled: store.enabled,
      hidden: !store.enabled,
      slash: { name: "ws-new", aliases: ["wsn"] },
      onSelect() {
        showCreateDialog(api, actions)
      },
    },
    {
      title: "Switch workspace",
      value: "workspace.switch",
      category: "Workspace",
      enabled: store.enabled && store.workspaces.length > 1,
      hidden: !store.enabled || store.workspaces.length <= 1,
      slash: { name: "ws-switch", aliases: ["wss"] },
      onSelect() {
        showSwitchDialog(api, actions)
      },
    },
    {
      title: "Manage workspaces",
      value: "workspace.manage",
      category: "Workspace",
      slash: { name: "workspaces", aliases: ["wsm"] },
      enabled: store.enabled,
      hidden: !store.enabled,
      onSelect() {
        api.route.navigate("workspaces")
      },
    },
    {
      title: sessionTitle,
      value: "workspace.session",
      category: "Workspace",
      enabled: store.enabled && !!store.currentID,
      hidden: !store.enabled || !store.currentID,
      slash: { name: "ws-session", aliases: ["wsc"] },
      async onSelect() {
        const session = await actions.createSession()
        if (session) api.route.navigate("session", { sessionID: session.id })
      },
    },
    {
      title: "Browse workspace sessions",
      value: "workspace.sessions",
      category: "Workspace",
      enabled: store.enabled && store.sessions.length > 0,
      hidden: !store.enabled,
      slash: { name: "ws-sessions", aliases: ["wsl"] },
      onSelect() {
        showSessionsDialog(api, actions)
      },
    },
    {
      title: "Rename current workspace",
      value: "workspace.rename",
      category: "Workspace",
      enabled: !!isSandbox,
      hidden: !isSandbox,
      onSelect() {
        if (current) showRenameDialog(api, current, actions)
      },
    },
    {
      title: "Reset current workspace",
      value: "workspace.reset",
      category: "Workspace",
      enabled: !!isSandbox,
      hidden: !isSandbox,
      onSelect() {
        if (current) showResetDialog(api, current, actions)
      },
    },
    {
      title: "Delete current workspace",
      value: "workspace.delete",
      category: "Workspace",
      enabled: !!isSandbox,
      hidden: !isSandbox,
      onSelect() {
        if (current) showDeleteDialog(api, current, actions)
      },
    },
  ]
}
