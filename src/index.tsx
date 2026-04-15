/**
 * opencode-workspaces — TUI Workspace Plugin for OpenCode
 *
 * Standalone workspace (git worktree) management for the OpenCode TUI.
 * Switch between git worktrees in the same TUI session, no terminal spawning.
 *
 * Features:
 *   - Sidebar: workspace list with real-time status + quick actions footer
 *   - Home screen: workspace dashboard + prompt badge
 *   - Full management route: create, rename, reset, delete, session browser
 *   - Command palette + slash commands (/ws, /ws-new, /ws-switch, etc.)
 *   - KV-persisted state (enabled flag, current workspace, custom names)
 *
 * Installation (in ~/.config/opencode/tui.json):
 *   { "plugin": ["opencode-workspaces"] }
 *
 * Or for local development:
 *   { "plugin": ["/path/to/opencode-workspaces/src/index.tsx"] }
 */

import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { HomeBadge, HomeDashboard, SidebarFooterActions, SidebarWorkspaceList } from "./components.js"
import { buildCommands } from "./commands.js"
import { ManageRoute } from "./manage-route.js"
import { createWsStore } from "./store.js"

// ─── Plugin main ──────────────────────────────────────────────────────────────

const tui: TuiPlugin = async (api) => {
  const actions = createWsStore(api)
  const { store } = actions

  // Initial sync
  if (store.enabled) {
    actions.sync()
    actions.syncSessionCounts()
  }

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
      // Sidebar workspace list (append mode — rendered below session list)
      sidebar_content(_ctx, props) {
        return <SidebarWorkspaceList api={api} actions={actions} sessionId={props.session_id} />
      },
      // Sidebar footer: new/switch/manage buttons (single_winner)
      sidebar_footer() {
        return <SidebarFooterActions api={api} actions={actions} />
      },
      // Home: workspace dashboard card (append mode)
      home_bottom() {
        return <HomeDashboard api={api} actions={actions} />
      },
      // Home: current workspace badge next to prompt (append mode)
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
