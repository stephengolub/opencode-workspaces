import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createStore, produce } from "solid-js/store"
import { KV } from "./constants.js"
import { isLocal, wsName } from "./helpers.js"
import type { Session, Workspace, WsState } from "./types.js"

// ─── Store + Actions ──────────────────────────────────────────────────────────

export function createWsStore(api: TuiPluginApi) {
  const [store, setStore] = createStore<WsState>({
    enabled: api.kv.get(KV.enabled, false),
    workspaces: [],
    statuses: {},
    currentID: api.kv.get(KV.current, undefined),
    currentDirectory: api.state.path.directory,
    projectRootDir: api.state.path.directory,
    sessionCounts: {},
    sessions: [],
    sessionWorkspaceMap: {},
    loading: false,
    creating: false,
    error: undefined,
    busy: {},
    names: api.kv.get(KV.names, {}),
  })

  async function sync() {
    if (!store.enabled) return
    setStore("loading", true)
    setStore("error", undefined)
    try {
      let workspaces: Workspace[] = []

      // Try the experimental workspace API first; fall back to worktree.list()
      const workspaceListFn = api.client.experimental?.workspace?.list
      if (typeof workspaceListFn === "function") {
        try {
          const wsRes = await api.client.experimental.workspace.list()
          workspaces = wsRes.data ?? []
        } catch {
          // fall through to worktree fallback
        }
      }

      // Fallback: use worktree.list() which returns string[] of sandbox directories
      if (workspaces.length === 0) {
        try {
          const wtRes = await api.client.worktree.list()
          const dirs: string[] = wtRes.data ?? []
          const sandboxes: Workspace[] = dirs.map((dir) => {
            const parts = dir.split("/")
            const name = parts[parts.length - 1] ?? dir
            return {
              id: dir,
              type: "sandbox",
              name,
              branch: name,
              directory: dir,
              extra: null,
              projectID: "",
            } as Workspace
          })
          // Prepend a synthetic "local" workspace representing the project root
          const localDir = api.state.path.directory
          const localBranch = api.state.vcs?.branch ?? "main"
          const local: Workspace = {
            id: "local",
            type: "local",
            name: localBranch,
            branch: localBranch,
            directory: localDir,
            extra: null,
            projectID: "",
          } as Workspace
          workspaces = [local, ...sandboxes]
        } catch {
          // worktree list also failed — leave workspaces empty
        }
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
    } catch (e) {
      setStore("error", e instanceof Error ? e.message : String(e))
    } finally {
      setStore("loading", false)
    }
  }

  async function syncSessionCounts() {
    if (!store.enabled) return
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

  api.event.on("worktree.ready", async (evt) => {
    const branch = evt.properties.branch
    const name = evt.properties.name ?? branch ?? "workspace"
    setStore(produce((s) => { s.busy = {}; s.creating = false }))
    api.ui.toast({ variant: "success", message: `Workspace ready: ${name}` })
    await sync()
    syncSessionCounts()
    // Auto-switch to the newly created workspace
    const newWs = store.workspaces.find((w) => w.branch === branch)
    if (newWs) setCurrent(newWs.id)
  })

  api.event.on("workspace.ready", (evt) => {
    const name = evt.properties.name ?? "workspace"
    setStore(produce((s) => { s.busy = {}; s.creating = false }))
    api.ui.toast({ variant: "success", message: `Workspace ready: ${name}` })
    sync()
    syncSessionCounts()
  })

  api.event.on("worktree.failed", (evt) => {
    const msg = evt.properties.message ?? "Unknown error"
    setStore(produce((s) => { s.busy = {}; s.creating = false }))
    api.ui.toast({ variant: "error", message: `Workspace failed: ${msg}` })
    sync()
  })

  api.event.on("workspace.failed", (evt) => {
    const msg = evt.properties.message ?? "Unknown error"
    setStore(produce((s) => { s.busy = {}; s.creating = false }))
    api.ui.toast({ variant: "error", message: `Workspace failed: ${msg}` })
    sync()
  })

  function setEnabled(val: boolean) {
    setStore("enabled", val)
    api.kv.set(KV.enabled, val)
    if (val) {
      sync()
      syncSessionCounts()
    }
  }

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
    setStore("creating", true)
    try {
      const res = await api.client.worktree.create({
        worktreeCreateInput: name ? { name } : undefined,
      })
      const branch = res.data?.branch ?? res.data?.name ?? "workspace"
      api.ui.toast({ variant: "info", message: `Creating workspace: ${branch}…` })
      // Refresh list — worktree.ready SSE will clear creating flag
      await sync()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      api.ui.toast({ variant: "error", message: `Failed to create workspace: ${msg}` })
      setStore("creating", false)
    }
  }

  async function deleteWorkspace(id: string, directory: string) {
    setStore("busy", id, true)
    try {
      await api.client.worktree.remove({ worktreeRemoveInput: { directory } })
      if (store.currentID === id) {
        const remaining = store.workspaces.find((w) => w.id !== id)
        setCurrent(remaining?.id)
      }
      await sync()
      api.ui.toast({ variant: "success", message: "Workspace deleted" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      api.ui.toast({ variant: "error", message: `Delete failed: ${msg}` })
    } finally {
      setStore("busy", id, false)
    }
  }

  async function resetWorkspace(id: string, directory: string) {
    setStore("busy", id, true)
    try {
      await api.client.worktree.reset({ worktreeResetInput: { directory } })
      await sync()
      api.ui.toast({ variant: "success", message: "Workspace reset" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      api.ui.toast({ variant: "error", message: `Reset failed: ${msg}` })
    } finally {
      setStore("busy", id, false)
    }
  }

  return {
    store,
    sync,
    syncSessionCounts,
    setEnabled,
    setCurrent,
    setName,
    createWorkspace,
    createSession,
    deleteWorkspace,
    resetWorkspace,
  }
}

export type WsActions = ReturnType<typeof createWsStore>
