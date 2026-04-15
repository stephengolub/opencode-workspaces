import { describe, it, expect, vi } from "vitest"
import { buildCommands } from "../src/commands.js"
import { createMockApi, localWs, sandboxWs } from "./mock-api.js"
import { createWsStore } from "../src/store.js"
import { KV } from "../src/constants.js"

function setup(options: { workspaces?: never[]; currentID?: string } = {}) {
  const api = createMockApi()
  if (options.currentID !== undefined) api.kv.set(KV.current, options.currentID)
  const actions = createWsStore(api as never)
  if (options.workspaces) {
    for (const ws of options.workspaces) {
      actions.store.workspaces.push(ws)
    }
  }
  return { api, actions }
}

// ─── Removed commands ─────────────────────────────────────────────────────────

describe("buildCommands — removed commands", () => {
  it("does NOT include workspace.toggle", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    expect(cmds.find((c) => c.value === "workspace.toggle")).toBeUndefined()
  })

  it("does NOT include workspace.delete", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    expect(cmds.find((c) => c.value === "workspace.delete")).toBeUndefined()
  })

  it("does NOT include workspace.reset", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    expect(cmds.find((c) => c.value === "workspace.reset")).toBeUndefined()
  })

  it("does NOT include workspace.manage (built-in /workspaces handles this)", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    expect(cmds.find((c) => c.value === "workspace.manage")).toBeUndefined()
  })
})

// ─── Always visible ───────────────────────────────────────────────────────────

describe("buildCommands — always visible", () => {
  it("includes workspace.menu command always", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    expect(cmds.find((c) => c.value === "workspace.menu")).toBeDefined()
  })

  it("workspace.menu has /ws slash command", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    const menu = cmds.find((c) => c.value === "workspace.menu")!
    expect(menu.slash?.name).toBe("ws")
    expect(menu.slash?.aliases).toContain("workspace")
  })

  it("includes workspace.new always", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.new")!
    expect(cmd).toBeDefined()
    expect(cmd.hidden).toBe(false)
    expect(cmd.enabled).toBe(true)
  })

})

// ─── Switch command visibility ────────────────────────────────────────────────

describe("buildCommands — switch command visibility", () => {
  it("workspace.switch is hidden when only 1 workspace", () => {
    const { api, actions } = setup({ workspaces: [localWs as never] })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.switch")!
    expect(cmd.hidden).toBe(true)
  })

  it("workspace.switch is visible with 2+ workspaces", () => {
    const { api, actions } = setup({ workspaces: [localWs as never, sandboxWs as never] })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.switch")!
    expect(cmd.hidden).toBe(false)
    expect(cmd.enabled).toBe(true)
  })
})

// ─── Sandbox-only commands ────────────────────────────────────────────────────

describe("buildCommands — sandbox-only commands", () => {
  it("workspace.rename is hidden when no current workspace", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.rename")!
    expect(cmd.hidden).toBe(true)
  })

  it("workspace.rename is hidden when current workspace is local", () => {
    const { api, actions } = setup({ workspaces: [localWs as never], currentID: "local" })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.rename")!
    expect(cmd.hidden).toBe(true)
  })

  it("workspace.rename is visible when current workspace is sandbox", () => {
    const { api, actions } = setup({
      workspaces: [localWs as never, sandboxWs as never],
      currentID: "ws-sandbox-1",
    })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.rename")!
    expect(cmd.hidden).toBe(false)
    expect(cmd.enabled).toBe(true)
  })
})

// ─── workspace.session ────────────────────────────────────────────────────────

describe("buildCommands — workspace.session", () => {
  it("is hidden when no currentID", () => {
    const { api, actions } = setup({ workspaces: [localWs as never] })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.session")!
    expect(cmd.hidden).toBe(true)
  })

  it("shows workspace name in title when current workspace exists", () => {
    const { api, actions } = setup({
      workspaces: [localWs as never, sandboxWs as never],
      currentID: "ws-sandbox-1",
    })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.session")!
    expect(cmd.title).toContain("feature-auth")
  })
})

// ─── Categories ───────────────────────────────────────────────────────────────

describe("buildCommands — command categories", () => {
  it("all workspace commands are in 'Workspace' category", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    for (const cmd of cmds) {
      expect(cmd.category).toBe("Workspace")
    }
  })
})

// ─── Slash commands ───────────────────────────────────────────────────────────

describe("buildCommands — slash commands", () => {
  it("workspace.new has /ws-new slash command", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.new")!
    expect(cmd.slash?.name).toBe("ws-new")
    expect(cmd.slash?.aliases).toContain("wsn")
  })
})

// ─── onSelect ────────────────────────────────────────────────────────────────

describe("buildCommands — onSelect invocations", () => {
  it("workspace.menu calls showWsMenu (dialog.replace)", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    const menu = cmds.find((c) => c.value === "workspace.menu")!
    menu.onSelect?.()
    expect(api.ui.dialog.replace).toHaveBeenCalled()
  })
})
