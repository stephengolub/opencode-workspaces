/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { For, Show, createMemo } from "solid-js"
import { STATUS_SYMBOL } from "./constants.ts"
import { showCreateDialog, showSwitchDialog } from "./dialogs.tsx"
import { isLocal, shortDir, wsName } from "./helpers.ts"
import type { WsActions } from "./store.ts"

// ─── Sidebar: footer actions ──────────────────────────────────────────────────

export function SidebarFooterActions(props: { api: TuiPluginApi; actions: WsActions }) {
  const theme = () => props.api.theme.current
  const store = props.actions.store

  return (
    <box flexDirection="row" gap={2} paddingTop={1}>
      <text
        fg={theme().textMuted}
        onMouseDown={() => showCreateDialog(props.api, props.actions)}
      >
        + new
      </text>
      <Show when={store.workspaces.length > 1}>
        <text
          fg={theme().textMuted}
          onMouseDown={() => showSwitchDialog(props.api, props.actions)}
        >
          ⎇ switch
        </text>
      </Show>
      <text
        fg={theme().textMuted}
        onMouseDown={() => props.api.route.navigate("workspaces")}
      >
        ≡ manage
      </text>
    </box>
  )
}

// ─── Home: workspace dashboard ────────────────────────────────────────────────

export function HomeDashboard(props: { api: TuiPluginApi; actions: WsActions }) {
  const theme = () => props.api.theme.current
  const store = props.actions.store

  return (
    <box
      border={["top"]}
      borderColor={theme().border}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      width={70}
      gap={1}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme().text}>Workspaces</text>
        <Show when={store.loading}>
          <text fg={theme().textMuted}>syncing…</text>
        </Show>
      </box>

      <Show
        when={store.workspaces.length > 0}
        fallback={<text fg={theme().textMuted}>No workspaces. Click "+ new" or use ctrl+p.</text>}
      >
        <For each={store.workspaces}>
          {(ws) => {
            const status = () => store.statuses[ws.id] ?? "disconnected"
            const sym = () => STATUS_SYMBOL[status()] ?? "○"
            const name = () => wsName(ws, store.names)
            const count = () => store.sessionCounts[ws.id] ?? 0
            const isCurrent = () => store.currentID === ws.id

            return (
              <box
                flexDirection="row"
                gap={2}
                onMouseDown={() => props.actions.setCurrent(ws.id)}
              >
                <text
                  fg={
                    status() === "connected"
                      ? theme().success
                      : status() === "error"
                        ? theme().error
                        : theme().textMuted
                  }
                >
                  {sym()}
                </text>
                <text
                  fg={isCurrent() ? theme().text : theme().textMuted}
                  flexGrow={1}
                  wrapMode="none"
                >
                  {isLocal(ws) ? "local" : "sandbox"} : {name()}
                  {isCurrent() ? " ◀" : ""}
                </text>
                <text fg={theme().textMuted}>
                  {count() > 0 ? `${count()} sess` : "empty"}
                </text>
              </box>
            )
          }}
        </For>
      </Show>

      <box flexDirection="row" gap={3} paddingTop={1}>
        <text
          fg={theme().textMuted}
          onMouseDown={() => showCreateDialog(props.api, props.actions)}
        >
          + new
        </text>
        <Show when={store.workspaces.length > 1}>
          <text
            fg={theme().textMuted}
            onMouseDown={() => showSwitchDialog(props.api, props.actions)}
          >
            ⎇ switch
          </text>
        </Show>
        <text
          fg={theme().textMuted}
          onMouseDown={() => props.api.route.navigate("workspaces")}
        >
          ≡ manage
        </text>
      </box>
    </box>
  )
}

// ─── Home: prompt workspace badge ─────────────────────────────────────────────

export function HomeBadge(props: { api: TuiPluginApi; actions: WsActions }) {
  const theme = () => props.api.theme.current
  const store = props.actions.store

  const current = createMemo(() =>
    store.currentID
      ? store.workspaces.find((w) => w.id === store.currentID)
      : undefined,
  )

  return (
    <Show when={current()}>
      {(ws) => (
        <box
          paddingLeft={1}
          paddingRight={1}
          border={["left"]}
          borderColor={theme().border}
        >
          <text fg={theme().textMuted}>
            ⎇ {wsName(ws(), store.names)}
            {ws().directory && ws().directory !== store.projectRootDir
              ? ` · ${shortDir(ws().directory)}`
              : ""}
          </text>
        </box>
      )}
    </Show>
  )
}
