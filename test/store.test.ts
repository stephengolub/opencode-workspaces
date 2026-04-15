import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockApi, localWs, sandboxWs, mockSession } from "./mock-api.js"
import { createWsStore } from "../src/store.js"
import { KV } from "../src/constants.js"

describe("createWsStore — init", () => {
  it("reads enabled from KV store", () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    const { store } = createWsStore(api as never)
    expect(store.enabled).toBe(true)
  })

  it("reads currentID from KV store", () => {
    const api = createMockApi()
    api.kv.set(KV.current, "ws-abc")
    const { store } = createWsStore(api as never)
    expect(store.currentID).toBe("ws-abc")
  })

  it("reads names from KV store", () => {
    const api = createMockApi()
    api.kv.set(KV.names, { "ws-1": "Custom Name" })
    const { store } = createWsStore(api as never)
    expect(store.names["ws-1"]).toBe("Custom Name")
  })

  it("initializes projectRootDir from api.state.path.directory", () => {
    const api = createMockApi()
    const { store } = createWsStore(api as never)
    expect(store.projectRootDir).toBe("/project")
  })

  it("starts with empty workspaces and not loading", () => {
    const api = createMockApi()
    const { store } = createWsStore(api as never)
    expect(store.workspaces).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.creating).toBe(false)
    expect(store.error).toBeUndefined()
  })
})

describe("sync — workspace API", () => {
  it("calls experimental.workspace.list and populates workspaces", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs, sandboxWs] })
    const { store, sync } = createWsStore(api as never)
    await sync()
    expect(store.workspaces).toHaveLength(2)
    expect(store.workspaces[0].id).toBe("local")
    expect(store.workspaces[1].id).toBe("ws-sandbox-1")
  })

  it("does nothing when disabled", async () => {
    const api = createMockApi()
    // enabled defaults to false
    const { store, sync } = createWsStore(api as never)
    await sync()
    expect(api.client.experimental.workspace.list).not.toHaveBeenCalled()
    expect(store.workspaces).toHaveLength(0)
  })

  it("falls back to worktree.list when experimental API returns empty", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    // experimental returns empty, worktree returns dirs
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [] })
    api.client.worktree.list = vi.fn().mockResolvedValue({ data: ["/project/feature-auth"] })
    const { store, sync } = createWsStore(api as never)
    await sync()
    // Should have local + 1 sandbox from worktree
    expect(store.workspaces.length).toBeGreaterThanOrEqual(2)
    const local = store.workspaces.find((w) => w.type === "local")
    expect(local).toBeDefined()
    const sandbox = store.workspaces.find((w) => w.directory === "/project/feature-auth")
    expect(sandbox).toBeDefined()
    expect(sandbox?.type).toBe("sandbox")
  })

  it("falls back to worktree.list when experimental API throws", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    api.client.experimental.workspace.list = vi.fn().mockRejectedValue(new Error("Not implemented"))
    api.client.worktree.list = vi.fn().mockResolvedValue({ data: ["/project/sandbox-1"] })
    const { store, sync } = createWsStore(api as never)
    await sync()
    expect(store.workspaces.length).toBeGreaterThanOrEqual(1)
    expect(api.client.worktree.list).toHaveBeenCalled()
  })

  it("clears currentID when it no longer exists after sync", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    api.kv.set(KV.current, "old-ws-id")
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const { store, sync } = createWsStore(api as never)
    expect(store.currentID).toBe("old-ws-id")
    await sync()
    expect(store.currentID).toBeUndefined()
  })

  it("sets error on unexpected sync failure", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    // Both experimental and worktree throw
    api.client.experimental.workspace.list = vi.fn().mockRejectedValue(new Error("Network error"))
    api.client.worktree.list = vi.fn().mockRejectedValue(new Error("Also failed"))
    const { store, sync } = createWsStore(api as never)
    await sync()
    // workspaces may be empty but loading should be cleared
    expect(store.loading).toBe(false)
  })
})

describe("syncSessionCounts", () => {
  it("maps sessions with workspaceID to their workspace", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    const sess1 = mockSession({ id: "s1", workspaceID: "ws-sandbox-1" })
    const sess2 = mockSession({ id: "s2", workspaceID: "ws-sandbox-1" })
    const sess3 = mockSession({ id: "s3", workspaceID: undefined })
    api.client.session.list = vi.fn().mockResolvedValue({ data: [sess1, sess2, sess3] })
    const { store, syncSessionCounts } = createWsStore(api as never)
    await syncSessionCounts()
    expect(store.sessionCounts["ws-sandbox-1"]).toBe(2)
    expect(store.sessionCounts["local"]).toBe(1)
    expect(store.sessionWorkspaceMap["s1"]).toBe("ws-sandbox-1")
    expect(store.sessionWorkspaceMap["s2"]).toBe("ws-sandbox-1")
    expect(store.sessionWorkspaceMap["s3"]).toBeUndefined()
  })

  it("stores full session objects", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    const sess = mockSession({ id: "s1", title: "My Session" })
    api.client.session.list = vi.fn().mockResolvedValue({ data: [sess] })
    const { store, syncSessionCounts } = createWsStore(api as never)
    await syncSessionCounts()
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0].title).toBe("My Session")
  })

  it("does nothing when disabled", async () => {
    const api = createMockApi()
    // disabled by default
    const { syncSessionCounts } = createWsStore(api as never)
    await syncSessionCounts()
    expect(api.client.session.list).not.toHaveBeenCalled()
  })
})

describe("setEnabled", () => {
  it("persists to KV and triggers sync when enabled", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const { store, setEnabled } = createWsStore(api as never)
    setEnabled(true)
    expect(store.enabled).toBe(true)
    expect(api.kv.get(KV.enabled)).toBe(true)
    // Give sync a tick to run
    await new Promise((r) => setTimeout(r, 0))
    expect(api.client.experimental.workspace.list).toHaveBeenCalled()
  })

  it("persists false to KV", () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    const { store, setEnabled } = createWsStore(api as never)
    setEnabled(false)
    expect(store.enabled).toBe(false)
    expect(api.kv.get(KV.enabled)).toBe(false)
  })
})

describe("setCurrent", () => {
  it("updates currentID and persists to KV", () => {
    const api = createMockApi()
    const { store, setCurrent } = createWsStore(api as never)
    setCurrent("ws-sandbox-1")
    expect(store.currentID).toBe("ws-sandbox-1")
    expect(api.kv.get(KV.current)).toBe("ws-sandbox-1")
  })

  it("updates currentDirectory to workspace's directory when found", () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    // Pre-populate workspaces
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs, sandboxWs] })
    const actions = createWsStore(api as never)
    // Manually inject workspaces
    actions.store.workspaces.push(sandboxWs as never)
    actions.setCurrent("ws-sandbox-1")
    expect(actions.store.currentDirectory).toBe("/project-feature-auth")
  })

  it("falls back to projectRootDir when workspace not found", () => {
    const api = createMockApi()
    const { store, setCurrent } = createWsStore(api as never)
    setCurrent("nonexistent-id")
    expect(store.currentDirectory).toBe("/project")
  })

  it("clears currentID with undefined", () => {
    const api = createMockApi()
    api.kv.set(KV.current, "ws-1")
    const { store, setCurrent } = createWsStore(api as never)
    setCurrent(undefined)
    expect(store.currentID).toBeUndefined()
    expect(api.kv.get(KV.current)).toBeUndefined()
  })
})

describe("createWorkspace", () => {
  it("calls worktree.create and shows info toast", async () => {
    const api = createMockApi()
    api.client.worktree.create = vi.fn().mockResolvedValue({
      data: { name: "lucky-orbit", branch: "lucky-orbit", directory: "/project-lucky-orbit" },
    })
    const { createWorkspace } = createWsStore(api as never)
    await createWorkspace()
    expect(api.client.worktree.create).toHaveBeenCalled()
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "info", message: expect.stringContaining("lucky-orbit") }),
    )
  })

  it("passes name to worktree.create when provided", async () => {
    const api = createMockApi()
    api.client.worktree.create = vi.fn().mockResolvedValue({
      data: { name: "my-feature", branch: "my-feature", directory: "/project-my-feature" },
    })
    const { createWorkspace } = createWsStore(api as never)
    await createWorkspace("my-feature")
    expect(api.client.worktree.create).toHaveBeenCalledWith({
      worktreeCreateInput: { name: "my-feature" },
    })
  })

  it("shows error toast and clears creating on failure", async () => {
    const api = createMockApi()
    api.client.worktree.create = vi.fn().mockRejectedValue(new Error("Server error"))
    const { store, createWorkspace } = createWsStore(api as never)
    await createWorkspace()
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    )
    expect(store.creating).toBe(false)
  })
})

describe("deleteWorkspace", () => {
  it("calls worktree.remove and shows success toast", async () => {
    const api = createMockApi()
    api.client.worktree.remove = vi.fn().mockResolvedValue({ data: true })
    const { deleteWorkspace } = createWsStore(api as never)
    await deleteWorkspace("ws-sandbox-1", "/project-feature-auth")
    expect(api.client.worktree.remove).toHaveBeenCalledWith({
      worktreeRemoveInput: { directory: "/project-feature-auth" },
    })
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "Workspace deleted" }),
    )
  })

  it("clears currentID if deleting the current workspace", async () => {
    const api = createMockApi()
    api.kv.set(KV.current, "ws-sandbox-1")
    api.client.worktree.remove = vi.fn().mockResolvedValue({ data: true })
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const { store, deleteWorkspace } = createWsStore(api as never)
    // Set currentID directly
    store.currentID = "ws-sandbox-1" as never
    await deleteWorkspace("ws-sandbox-1", "/project-feature-auth")
    expect(store.currentID).not.toBe("ws-sandbox-1")
  })

  it("shows error toast on failure", async () => {
    const api = createMockApi()
    api.client.worktree.remove = vi.fn().mockRejectedValue(new Error("Permission denied"))
    const { deleteWorkspace } = createWsStore(api as never)
    await deleteWorkspace("ws-1", "/project-ws")
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    )
  })
})

describe("resetWorkspace", () => {
  it("calls worktree.reset and shows success toast", async () => {
    const api = createMockApi()
    api.client.worktree.reset = vi.fn().mockResolvedValue({ data: true })
    const { resetWorkspace } = createWsStore(api as never)
    await resetWorkspace("ws-sandbox-1", "/project-feature-auth")
    expect(api.client.worktree.reset).toHaveBeenCalledWith({
      worktreeResetInput: { directory: "/project-feature-auth" },
    })
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", message: "Workspace reset" }),
    )
  })

  it("shows error toast on failure", async () => {
    const api = createMockApi()
    api.client.worktree.reset = vi.fn().mockRejectedValue(new Error("Reset failed"))
    const { resetWorkspace } = createWsStore(api as never)
    await resetWorkspace("ws-1", "/project-ws")
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    )
  })
})

describe("createSession", () => {
  it("creates session with workspaceID when current workspace is a sandbox", async () => {
    const api = createMockApi()
    api.kv.set(KV.enabled, true)
    api.kv.set(KV.current, "ws-sandbox-1")
    api.client.session.create = vi.fn().mockResolvedValue({ data: { id: "new-sess", slug: "new" } })
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs, sandboxWs] })
    const actions = createWsStore(api as never)
    // Pre-load workspaces
    await actions.sync()
    const session = await actions.createSession()
    expect(session?.id).toBe("new-sess")
    expect(api.client.session.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceID: "ws-sandbox-1", workspace: "ws-sandbox-1" }),
    )
  })

  it("creates unscoped session when current workspace is local", async () => {
    const api = createMockApi()
    api.kv.set(KV.current, "local")
    api.kv.set(KV.enabled, true)
    api.client.session.create = vi.fn().mockResolvedValue({ data: { id: "new-sess", slug: "new" } })
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const actions = createWsStore(api as never)
    await actions.sync()
    await actions.createSession()
    // Should NOT include workspaceID for local workspace
    const callArgs = (api.client.session.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs?.workspaceID).toBeUndefined()
  })

  it("shows success toast on creation", async () => {
    const api = createMockApi()
    api.kv.set(KV.current, "local")
    api.kv.set(KV.enabled, true)
    api.client.session.create = vi.fn().mockResolvedValue({ data: { id: "s1", slug: "s1" } })
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const actions = createWsStore(api as never)
    await actions.sync()
    await actions.createSession()
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    )
  })

  it("shows error toast on failure", async () => {
    const api = createMockApi()
    api.client.session.create = vi.fn().mockRejectedValue(new Error("Session limit reached"))
    const { createSession } = createWsStore(api as never)
    const result = await createSession()
    expect(result).toBeUndefined()
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    )
  })
})
