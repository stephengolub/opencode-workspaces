import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createStore } from "solid-js/store"
import { KV } from "./constants.ts"
import { isLocal, wsName } from "./helpers.ts"
import type { Session, Workspace, WsState } from "./types.ts"

// ─── Store + Actions ──────────────────────────────────────────────────────────

export function createWsStore(api: TuiPluginApi) {
  const [store, setStore] = createStore<WsState>({
    workspaces: [],
    statuses: {},
    currentID: api.kv.get(KV.current, undefined),
    currentDirectory: api.state.path.directory,
    projectRootDir: api.state.path.directory,
    sessionCounts: {},
    sessions: [],
    sessionWorkspaceMap: {},
    loading: false,
    names: api.kv.get(KV.names, {}),
  })

  async function sync() {
    setStore("loading", true)
    try {
      let workspaces: Workspace[] = []

      // Use the experimental workspace API (required)
      try {
        const wsRes = await api.client.experimental.workspace.list()
        workspaces = wsRes.data ?? []
      } catch {
        // experimental API unavailable or failed — leave workspaces empty
      }

      // Fetch statuses if available
      const statuses: Record<string, string> = {}
      const statusFn = api.client.experimental?.workspace?.status
      if (typeof statusFn === "function") {
        try {
          const statusRes = await api.client.experimental.workspace.status()
          for (const s of statusRes.data ?? []) {
            statuses[s.workspaceID] = s.status
          }
        } catch {
          // status endpoint not available — leave statuses empty
        }
      }

      setStore("workspaces", workspaces)
      setStore("statuses", statuses)
      // If currentID no longer exists, clear it
      if (store.currentID && !workspaces.find((w) => w.id === store.currentID)) {
        setStore("currentID", undefined)
        api.kv.set(KV.current, undefined)
      }
    } finally {
      setStore("loading", false)
    }
  }

  async function syncSessionCounts() {
    try {
      const res = await api.client.session.list({ limit: 500 })
      const all = (res.data ?? []) as Session[]
      const counts: Record<string, number> = {}
      const wsMap: Record<string, string> = {}
      let unscoped = 0
      for (const s of all) {
        if (s.workspaceID) {
          counts[s.workspaceID] = (counts[s.workspaceID] ?? 0) + 1
          wsMap[s.id] = s.workspaceID
        } else {
          unscoped++
        }
      }
      counts["local"] = unscoped
      setStore("sessions", all)
      setStore("sessionCounts", counts)
      setStore("sessionWorkspaceMap", wsMap)
    } catch {
      // non-critical
    }
  }

  async function createSession(title?: string) {
    const workspaceID = store.currentID
    const ws = store.workspaces.find((w) => w.id === workspaceID)
    const isWsScoped = workspaceID && ws && !isLocal(ws)
    try {
      const res = await api.client.session.create({
        ...(isWsScoped ? { workspaceID, workspace: workspaceID } : {}),
        ...(title ? { title } : {}),
      })
      if (res.data) {
        const label = ws ? wsName(ws, store.names) : "local"
        api.ui.toast({ variant: "success", message: `Session created in ${label}` })
        void syncSessionCounts()
      }
      return res.data
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      api.ui.toast({ variant: "error", message: `Failed to create session: ${msg}` })
      return undefined
    }
  }

  // SSE events
  api.event.on("workspace.status", (evt) => {
    const { workspaceID, status } = evt.properties
    setStore("statuses", workspaceID, status)
  })

  api.event.on("workspace.ready", () => {
    void sync()
    void syncSessionCounts()
  })

  api.event.on("workspace.failed", (evt) => {
    const msg = evt.properties.message ?? "Unknown error"
    api.ui.toast({ variant: "error", message: `Workspace failed: ${msg}` })
    void sync()
  })

  function setCurrent(id: string | undefined) {
    setStore("currentID", id)
    api.kv.set(KV.current, id)
    const ws = store.workspaces.find((w) => w.id === id)
    setStore("currentDirectory", ws?.directory ?? api.state.path.directory)
  }

  function setName(id: string, name: string) {
    const updated = { ...store.names, [id]: name }
    setStore("names", updated)
    api.kv.set(KV.names, updated)
  }

  async function createWorkspace(name?: string) {
    try {
      await api.client.experimental.workspace.create({
        type: "sandbox",
        branch: name ?? null,
      })
      api.ui.toast({ variant: "info", message: `Creating workspace${name ? `: ${name}` : ""}…` })
      // workspace.ready SSE will trigger sync
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      api.ui.toast({ variant: "error", message: `Failed to create workspace: ${msg}` })
    }
  }

  return {
    store,
    sync,
    syncSessionCounts,
    setCurrent,
    setName,
    createWorkspace,
    createSession,
  }
}

export type WsActions = ReturnType<typeof createWsStore>
