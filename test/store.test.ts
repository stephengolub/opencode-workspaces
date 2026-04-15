import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockApi, localWs, sandboxWs, mockSession } from "./mock-api.js"
import { createWsStore } from "../src/store.js"
import { KV } from "../src/constants.js"

// ─── Init ─────────────────────────────────────────────────────────────────────

describe("createWsStore — init", () => {
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
  })

  it("does NOT have enabled, creating, error, or busy in state", () => {
    const api = createMockApi()
    const { store } = createWsStore(api as never)
    expect((store as Record<string, unknown>).enabled).toBeUndefined()
    expect((store as Record<string, unknown>).creating).toBeUndefined()
    expect((store as Record<string, unknown>).error).toBeUndefined()
    expect((store as Record<string, unknown>).busy).toBeUndefined()
  })
})

// ─── sync ─────────────────────────────────────────────────────────────────────

describe("sync — workspace API", () => {
  it("calls experimental.workspace.list and populates workspaces", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs, sandboxWs] })
    const { store, sync } = createWsStore(api as never)
    await sync()
    expect(store.workspaces).toHaveLength(2)
    expect(store.workspaces[0].id).toBe("local")
    expect(store.workspaces[1].id).toBe("ws-sandbox-1")
  })

  it("always runs (no enabled guard)", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const { sync } = createWsStore(api as never)
    await sync()
    // Always called — no enabled flag check
    expect(api.client.experimental.workspace.list).toHaveBeenCalled()
  })

  it("does NOT fall back to worktree.list when experimental returns empty", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [] })
    const { store, sync } = createWsStore(api as never)
    await sync()
    // No worktree fallback — empty list stays empty
    expect(api.client.worktree.list).not.toHaveBeenCalled()
    expect(store.workspaces).toHaveLength(0)
  })

  it("does NOT call worktree.list even when experimental throws", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.list = vi.fn().mockRejectedValue(new Error("Not implemented"))
    const { sync } = createWsStore(api as never)
    await sync()
    expect(api.client.worktree.list).not.toHaveBeenCalled()
  })

  it("clears currentID when it no longer exists after sync", async () => {
    const api = createMockApi()
    api.kv.set(KV.current, "old-ws-id")
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const { store, sync } = createWsStore(api as never)
    expect(store.currentID).toBe("old-ws-id")
    await sync()
    expect(store.currentID).toBeUndefined()
  })

  it("loading is false after successful sync", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs] })
    const { store, sync } = createWsStore(api as never)
    await sync()
    expect(store.loading).toBe(false)
  })

  it("loading is false after sync failure", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.list = vi.fn().mockRejectedValue(new Error("Fail"))
    const { store, sync } = createWsStore(api as never)
    await sync()
    expect(store.loading).toBe(false)
  })
})

// ─── syncSessionCounts ────────────────────────────────────────────────────────

describe("syncSessionCounts", () => {
  it("maps sessions with workspaceID to their workspace", async () => {
    const api = createMockApi()
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
    const sess = mockSession({ id: "s1", title: "My Session" })
    api.client.session.list = vi.fn().mockResolvedValue({ data: [sess] })
    const { store, syncSessionCounts } = createWsStore(api as never)
    await syncSessionCounts()
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0].title).toBe("My Session")
  })

  it("always runs (no enabled guard)", async () => {
    const api = createMockApi()
    api.client.session.list = vi.fn().mockResolvedValue({ data: [] })
    const { syncSessionCounts } = createWsStore(api as never)
    await syncSessionCounts()
    expect(api.client.session.list).toHaveBeenCalled()
  })
})

// ─── setCurrent ───────────────────────────────────────────────────────────────

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

// ─── createWorkspace ──────────────────────────────────────────────────────────

describe("createWorkspace", () => {
  it("calls experimental.workspace.create (not worktree.create)", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.create = vi.fn().mockResolvedValue({ data: sandboxWs })
    const { createWorkspace } = createWsStore(api as never)
    await createWorkspace()
    expect(api.client.experimental.workspace.create).toHaveBeenCalled()
    expect(api.client.worktree.create).not.toHaveBeenCalled()
  })

  it("passes branch name to experimental.workspace.create when provided", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.create = vi.fn().mockResolvedValue({ data: sandboxWs })
    const { createWorkspace } = createWsStore(api as never)
    await createWorkspace("my-feature")
    expect(api.client.experimental.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "my-feature" }),
    )
  })

  it("passes null branch when no name provided", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.create = vi.fn().mockResolvedValue({ data: sandboxWs })
    const { createWorkspace } = createWsStore(api as never)
    await createWorkspace()
    expect(api.client.experimental.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({ branch: null }),
    )
  })

  it("shows info toast on success", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.create = vi.fn().mockResolvedValue({ data: sandboxWs })
    const { createWorkspace } = createWsStore(api as never)
    await createWorkspace()
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "info" }),
    )
  })

  it("shows error toast on failure", async () => {
    const api = createMockApi()
    api.client.experimental.workspace.create = vi.fn().mockRejectedValue(new Error("Server error"))
    const { createWorkspace } = createWsStore(api as never)
    await createWorkspace()
    expect(api.ui.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" }),
    )
  })
})

// ─── setName ─────────────────────────────────────────────────────────────────

describe("setName", () => {
  it("updates names map and persists to KV", () => {
    const api = createMockApi()
    const { store, setName } = createWsStore(api as never)
    setName("ws-1", "My Workspace")
    expect(store.names["ws-1"]).toBe("My Workspace")
    const stored = api.kv.get<Record<string, string>>(KV.names)
    expect(stored?.["ws-1"]).toBe("My Workspace")
  })
})

// ─── createSession ────────────────────────────────────────────────────────────

describe("createSession", () => {
  it("creates session with workspaceID when current workspace is a sandbox", async () => {
    const api = createMockApi()
    api.kv.set(KV.current, "ws-sandbox-1")
    api.client.session.create = vi.fn().mockResolvedValue({ data: { id: "new-sess", slug: "new" } })
    api.client.experimental.workspace.list = vi.fn().mockResolvedValue({ data: [localWs, sandboxWs] })
    const actions = createWsStore(api as never)
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

// ─── Removed actions ──────────────────────────────────────────────────────────

describe("removed actions", () => {
  it("does not expose setEnabled", () => {
    const api = createMockApi()
    const actions = createWsStore(api as never)
    expect((actions as Record<string, unknown>).setEnabled).toBeUndefined()
  })

  it("does not expose deleteWorkspace", () => {
    const api = createMockApi()
    const actions = createWsStore(api as never)
    expect((actions as Record<string, unknown>).deleteWorkspace).toBeUndefined()
  })

  it("does not expose resetWorkspace", () => {
    const api = createMockApi()
    const actions = createWsStore(api as never)
    expect((actions as Record<string, unknown>).resetWorkspace).toBeUndefined()
  })
})
