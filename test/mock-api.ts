/**
 * Shared mock factory for TuiPluginApi.
 * Returns a minimal object with vi.fn() stubs for all SDK methods used by the plugin.
 */
import { vi } from "vitest"
import type { Workspace, Session } from "../src/types.js"

// In-memory KV store
function createMockKV() {
  const map = new Map<string, unknown>()
  return {
    ready: true,
    get<T>(key: string, defaultVal?: T): T {
      return (map.has(key) ? map.get(key) : defaultVal) as T
    },
    set(key: string, val: unknown) {
      map.set(key, val)
    },
    _map: map,
  }
}

export type MockKV = ReturnType<typeof createMockKV>

// Default workspace fixtures
export const localWs: Workspace = {
  id: "local",
  type: "local",
  name: "main",
  branch: "main",
  directory: "/project",
  extra: null,
  projectID: "proj1",
}

export const sandboxWs: Workspace = {
  id: "ws-sandbox-1",
  type: "sandbox",
  name: "feature-auth",
  branch: "feature-auth",
  directory: "/project-feature-auth",
  extra: null,
  projectID: "proj1",
}

export const mockSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: "sess-1",
    slug: "test-session",
    title: "Test Session",
    projectID: "proj1",
    directory: "/project",
    workspaceID: undefined,
    parentID: undefined,
    time: { created: 1000, updated: 2000 },
    ...overrides,
  } as unknown as Session)

export function createMockApi(overrides: Partial<ReturnType<typeof buildMockApi>> = {}) {
  return { ...buildMockApi(), ...overrides }
}

function buildMockApi() {
  const kv = createMockKV()

  return {
    kv,
    state: {
      path: {
        directory: "/project",
        state: "/state",
        config: "/config",
        worktree: "/project",
      },
      vcs: { branch: "main" },
      ready: true,
      config: {},
      provider: [],
      session: {
        count: () => 0,
        diff: () => [],
        todo: () => [],
        messages: () => [],
        status: () => undefined,
        permission: () => [],
        question: () => [],
      },
      part: () => [],
      lsp: () => [],
      mcp: () => [],
    },
    client: {
      worktree: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ data: { name: "lucky-orbit", branch: "lucky-orbit", directory: "/project-lucky-orbit" } }),
        remove: vi.fn().mockResolvedValue({ data: true }),
        reset: vi.fn().mockResolvedValue({ data: true }),
      },
      session: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ data: { id: "new-sess-1", slug: "new-session" } }),
      },
      experimental: {
        workspace: {
          list: vi.fn().mockResolvedValue({ data: [] }),
          status: vi.fn().mockResolvedValue({ data: [] }),
          create: vi.fn().mockResolvedValue({ data: localWs }),
          remove: vi.fn().mockResolvedValue({ data: undefined }),
        },
      },
    },
    event: {
      on: vi.fn().mockReturnValue(() => {}),
    },
    ui: {
      toast: vi.fn(),
      dialog: {
        replace: vi.fn(),
        clear: vi.fn(),
        setSize: vi.fn(),
        size: "medium",
        depth: 0,
        open: false,
      },
      Dialog: vi.fn(),
      DialogAlert: vi.fn(),
      DialogConfirm: vi.fn(),
      DialogPrompt: vi.fn(),
      DialogSelect: vi.fn(),
      Prompt: vi.fn(),
      Slot: vi.fn(),
    },
    route: {
      navigate: vi.fn(),
      register: vi.fn(),
      current: { name: "home" },
    },
    command: {
      register: vi.fn(),
      trigger: vi.fn(),
      show: vi.fn(),
    },
    slots: {
      register: vi.fn(),
    },
    lifecycle: {
      signal: new AbortController().signal,
      onDispose: vi.fn(),
    },
    keybind: {
      match: vi.fn(),
      print: vi.fn(),
      create: vi.fn(),
    },
    theme: {
      current: {} as never,
      selected: "default",
      has: vi.fn(),
      set: vi.fn(),
      install: vi.fn(),
      mode: () => "dark" as const,
      ready: true,
    },
    plugins: {
      list: vi.fn(),
      activate: vi.fn(),
      deactivate: vi.fn(),
      add: vi.fn(),
      install: vi.fn(),
    },
    tuiConfig: {},
    app: { version: "1.4.0" },
    renderer: {} as never,
  }
}
