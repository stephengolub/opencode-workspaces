import { describe, it, expect, vi } from "vitest"
import { buildCommands } from "../src/commands.js"
import { createMockApi, localWs, sandboxWs } from "./mock-api.js"
import { createWsStore } from "../src/store.js"
import { KV } from "../src/constants.js"

function setup(options: { enabled?: boolean; workspaces?: never[]; currentID?: string } = {}) {
  const api = createMockApi()
  if (options.enabled !== undefined) api.kv.set(KV.enabled, options.enabled)
  if (options.currentID !== undefined) api.kv.set(KV.current, options.currentID)
  const actions = createWsStore(api as never)
  if (options.workspaces) {
    for (const ws of options.workspaces) {
      actions.store.workspaces.push(ws)
    }
  }
  return { api, actions }
}

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

  it("includes workspace.toggle always", () => {
    const { api, actions } = setup()
    const cmds = buildCommands(api as never, actions)
    expect(cmds.find((c) => c.value === "workspace.toggle")).toBeDefined()
  })

  it("workspace.toggle says 'Enable' when disabled", () => {
    const { api, actions } = setup({ enabled: false })
    const cmds = buildCommands(api as never, actions)
    const toggle = cmds.find((c) => c.value === "workspace.toggle")!
    expect(toggle.title).toContain("Enable")
  })

  it("workspace.toggle says 'Disable' when enabled", () => {
    const { api, actions } = setup({ enabled: true })
    const cmds = buildCommands(api as never, actions)
    const toggle = cmds.find((c) => c.value === "workspace.toggle")!
    expect(toggle.title).toContain("Disable")
  })
})

describe("buildCommands — hidden when disabled", () => {
  it("workspace.new is hidden when disabled", () => {
    const { api, actions } = setup({ enabled: false })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.new")!
    expect(cmd.hidden).toBe(true)
    expect(cmd.enabled).toBe(false)
  })

  it("workspace.manage is hidden when disabled", () => {
    const { api, actions } = setup({ enabled: false })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.manage")!
    expect(cmd.hidden).toBe(true)
  })

  it("workspace.new is visible when enabled", () => {
    const { api, actions } = setup({ enabled: true })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.new")!
    expect(cmd.hidden).toBe(false)
    expect(cmd.enabled).toBe(true)
  })
})

describe("buildCommands — switch command visibility", () => {
  it("workspace.switch is hidden when only 1 workspace", () => {
    const { api, actions } = setup({ enabled: true, workspaces: [localWs as never] })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.switch")!
    expect(cmd.hidden).toBe(true)
  })

  it("workspace.switch is visible with 2+ workspaces", () => {
    const { api, actions } = setup({ enabled: true, workspaces: [localWs as never, sandboxWs as never] })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.switch")!
    expect(cmd.hidden).toBe(false)
    expect(cmd.enabled).toBe(true)
  })
})

describe("buildCommands — sandbox-only commands", () => {
  it("workspace.rename is hidden when no current workspace", () => {
    const { api, actions } = setup({ enabled: true })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.rename")!
    expect(cmd.hidden).toBe(true)
  })

  it("workspace.rename is hidden when current workspace is local", () => {
    const { api, actions } = setup({ enabled: true, workspaces: [localWs as never], currentID: "local" })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.rename")!
    expect(cmd.hidden).toBe(true)
  })

  it("workspace.rename is visible when current workspace is sandbox", () => {
    const { api, actions } = setup({
      enabled: true,
      workspaces: [localWs as never, sandboxWs as never],
      currentID: "ws-sandbox-1",
    })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.rename")!
    expect(cmd.hidden).toBe(false)
    expect(cmd.enabled).toBe(true)
  })

  it("workspace.reset and workspace.delete follow same rules as rename", () => {
    const { api, actions } = setup({
      enabled: true,
      workspaces: [localWs as never, sandboxWs as never],
      currentID: "ws-sandbox-1",
    })
    const cmds = buildCommands(api as never, actions)
    expect(cmds.find((c) => c.value === "workspace.reset")?.hidden).toBe(false)
    expect(cmds.find((c) => c.value === "workspace.delete")?.hidden).toBe(false)
  })
})

describe("buildCommands — workspace.session", () => {
  it("is hidden when disabled", () => {
    const { api, actions } = setup({ enabled: false })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.session")!
    expect(cmd.hidden).toBe(true)
  })

  it("is hidden when no currentID even if enabled", () => {
    const { api, actions } = setup({ enabled: true, workspaces: [localWs as never] })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.session")!
    expect(cmd.hidden).toBe(true)
  })

  it("shows workspace name in title when current workspace exists", () => {
    const { api, actions } = setup({
      enabled: true,
      workspaces: [localWs as never, sandboxWs as never],
      currentID: "ws-sandbox-1",
    })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.session")!
    expect(cmd.title).toContain("feature-auth")
  })
})

describe("buildCommands — command categories", () => {
  it("all workspace commands are in 'Workspace' category", () => {
    const { api, actions } = setup({ enabled: true })
    const cmds = buildCommands(api as never, actions)
    for (const cmd of cmds) {
      expect(cmd.category).toBe("Workspace")
    }
  })
})

describe("buildCommands — slash commands", () => {
  it("workspace.manage has /workspaces slash command", () => {
    const { api, actions } = setup({ enabled: true })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.manage")!
    expect(cmd.slash?.name).toBe("workspaces")
    expect(cmd.slash?.aliases).toContain("wsm")
  })

  it("workspace.new has /ws-new slash command", () => {
    const { api, actions } = setup({ enabled: true })
    const cmds = buildCommands(api as never, actions)
    const cmd = cmds.find((c) => c.value === "workspace.new")!
    expect(cmd.slash?.name).toBe("ws-new")
    expect(cmd.slash?.aliases).toContain("wsn")
  })
})

describe("buildCommands — onSelect invocations", () => {
  it("workspace.toggle calls actions.setEnabled with toggled value", () => {
    const { api, actions } = setup({ enabled: false })
    const spy = vi.spyOn(actions, "setEnabled")
    const cmds = buildCommands(api as never, actions)
    const toggle = cmds.find((c) => c.value === "workspace.toggle")!
    toggle.onSelect?.()
    expect(spy).toHaveBeenCalledWith(true)
  })

  it("workspace.manage calls api.route.navigate('workspaces')", () => {
    const { api, actions } = setup({ enabled: true })
    const cmds = buildCommands(api as never, actions)
    const manage = cmds.find((c) => c.value === "workspace.manage")!
    manage.onSelect?.()
    expect(api.route.navigate).toHaveBeenCalledWith("workspaces")
  })
})
