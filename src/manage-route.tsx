import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { useKeyboard } from "@opentui/solid"
import { For, Show, createSignal } from "solid-js"
import { STATUS_SYMBOL } from "./constants.js"
import { showCreateDialog, showDeleteDialog, showRenameDialog, showResetDialog } from "./dialogs.js"
import { isLocal, shortDir, wsName } from "./helpers.js"
import type { WsActions } from "./store.js"

// ─── Full-screen workspace management route ───────────────────────────────────

export function ManageRoute(props: { api: TuiPluginApi; actions: WsActions }) {
  const theme = () => props.api.theme.current
  const store = props.actions.store
  const workspaces = () => store.workspaces

  const [selected, setSelected] = createSignal(0)
  const sel = () => workspaces()[selected()]

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      evt.stopPropagation()
      props.api.route.navigate("home")
      return
    }
    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault()
      setSelected((i) => Math.max(0, i - 1))
      return
    }
    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault()
      setSelected((i) => Math.min(workspaces().length - 1, i + 1))
      return
    }
    if (evt.name === "n" || evt.name === "c") {
      evt.preventDefault()
      showCreateDialog(props.api, props.actions)
      return
    }
    if (evt.name === "return" && sel()) {
      evt.preventDefault()
      props.actions.setCurrent(sel()!.id)
      props.api.route.navigate("home")
      return
    }
    if (sel() && !isLocal(sel()!)) {
      if (evt.name === "r") {
        evt.preventDefault()
        showRenameDialog(props.api, sel()!, props.actions)
        return
      }
      if (evt.name === "R") {
        evt.preventDefault()
        showResetDialog(props.api, sel()!, props.actions)
        return
      }
      if (evt.name === "d") {
        evt.preventDefault()
        showDeleteDialog(props.api, sel()!, props.actions)
        return
      }
    }
  })

  return (
    <box
      width="100%"
      height="100%"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme().text}>Workspaces</text>
        <text fg={theme().textMuted}>Esc back · n new · ↑↓ navigate · Enter switch</text>
      </box>

      {/* Workspace list */}
      <Show
        when={workspaces().length > 0}
        fallback={
          <box paddingTop={2}>
            <text fg={theme().textMuted}>No workspaces. Press n to create one.</text>
          </box>
        }
      >
        <For each={workspaces()}>
          {(ws, idx) => {
            const isSelected = () => selected() === idx()
            const status = () => store.statuses[ws.id] ?? "disconnected"
            const sym = () => store.busy[ws.id] ? "⟳" : (STATUS_SYMBOL[status()] ?? "○")
            const name = () => wsName(ws, store.names)
            const count = () => store.sessionCounts[ws.id] ?? 0
            const isCurrent = () => store.currentID === ws.id

            return (
              <box
                paddingLeft={1}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
                backgroundColor={isSelected() ? theme().backgroundElement : undefined}
                onMouseDown={() => {
                  setSelected(idx())
                  props.actions.setCurrent(ws.id)
                  props.api.route.navigate("home")
                }}
              >
                <box flexDirection="row" gap={2} paddingTop={1} paddingBottom={1}>
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
                  <box flexGrow={1} gap={0}>
                    <text fg={isSelected() ? theme().text : theme().textMuted}>
                      {isLocal(ws) ? "local" : "sandbox"} : {name()}
                      {isCurrent() ? " ◀" : ""}
                    </text>
                    <text fg={theme().textMuted}>
                      {shortDir(ws.directory)}
                    </text>
                    <text fg={theme().textMuted}>
                      {count()} session{count() === 1 ? "" : "s"}
                      {ws.branch ? ` · ${ws.branch}` : ""}
                      {store.busy[ws.id] ? " · busy…" : ""}
                    </text>
                  </box>
                </box>
                <Show when={isSelected()}>
                  {/* Sessions for this workspace */}
                  {() => {
                    const wsSessions = () => {
                      const sessions = store.sessions
                      if (isLocal(ws)) {
                        return sessions.filter((s) => !s.workspaceID).slice(0, 5)
                      }
                      return sessions.filter((s) => s.workspaceID === ws.id).slice(0, 5)
                    }
                    return (
                      <Show when={wsSessions().length > 0}>
                        <box paddingLeft={2} paddingBottom={1} gap={0}>
                          <For each={wsSessions()}>
                            {(s) => (
                              <text
                                fg={theme().textMuted}
                                wrapMode="none"
                                onMouseDown={() => props.api.route.navigate("session", { sessionID: s.id })}
                              >
                                · {s.title ?? s.slug ?? s.id}
                              </text>
                            )}
                          </For>
                        </box>
                      </Show>
                    )
                  }}
                  {/* Action hints (sandbox only) */}
                  <Show when={!isLocal(ws)}>
                    <box flexDirection="row" gap={2} paddingBottom={1}>
                      <text fg={theme().textMuted}>r rename</text>
                      <text fg={theme().textMuted}>R reset</text>
                      <text fg={theme().error}>d delete</text>
                    </box>
                  </Show>
                </Show>
              </box>
            )
          }}
        </For>
      </Show>

      <Show when={store.error}>
        <text fg={theme().error}>{store.error}</text>
      </Show>
    </box>
  )
}
