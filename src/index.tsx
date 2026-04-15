/** @jsxImportSource @opentui/solid */
/**
 * opencode-workspaces — TUI Workspace Plugin for OpenCode
 *
 * Extends the OpenCode TUI with workspace (git worktree) UX: switching,
 * renaming, session browsing, a home dashboard, and a prompt badge.
 *
 * Requires: OPENCODE_EXPERIMENTAL_WORKSPACES=1
 *
 * Installation (in ~/.config/opencode/tui.json):
 *   { "plugin": ["opencode-workspaces"] }
 *
 * Or for local development:
 *   { "plugin": ["/path/to/opencode-workspaces/src/index.tsx"] }
 */

import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { HomeBadge, HomeDashboard, SidebarFooterActions } from "./components.tsx"
import { buildCommands } from "./commands.ts"
import { ManageRoute } from "./manage-route.tsx"
import { createWsStore } from "./store.ts"

// ─── Plugin main ──────────────────────────────────────────────────────────────

const tui: TuiPlugin = async (api) => {
  // Require OPENCODE_EXPERIMENTAL_WORKSPACES=1 — the workspace API must be available
  if (typeof api.client.experimental?.workspace?.list !== "function") {
    api.ui.toast({
      variant: "error",
      message: "opencode-workspaces requires OPENCODE_EXPERIMENTAL_WORKSPACES=1",
    })
    return
  }

  const actions = createWsStore(api)

  // Initial sync (unconditional — no enabled flag)
  actions.sync()
  actions.syncSessionCounts()

  // ── Route ────────────────────────────────────────────────────────────────
  api.route.register([
    {
      name: "workspaces",
      render: () => <ManageRoute api={api} actions={actions} />,
    },
  ])

  // ── Commands ─────────────────────────────────────────────────────────────
  api.command.register(() => buildCommands(api, actions))

  // ── Slots ─────────────────────────────────────────────────────────────────
  api.slots.register({
    order: 200,
    slots: {
      // Sidebar footer: new/switch/manage buttons
      sidebar_footer() {
        return <SidebarFooterActions api={api} actions={actions} />
      },
      // Home: workspace dashboard card
      home_bottom() {
        return <HomeDashboard api={api} actions={actions} />
      },
      // Home: current workspace badge next to prompt
      home_prompt_right() {
        return <HomeBadge api={api} actions={actions} />
      },
    },
  })
}

// ─── Plugin export ────────────────────────────────────────────────────────────

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-workspaces",
  tui,
}

export default plugin
