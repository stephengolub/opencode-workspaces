import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { wsName, isLocal, shortDir, relativeTime } from "../src/helpers.js"
import type { Workspace } from "../src/types.js"

const base: Workspace = {
  id: "ws-1",
  type: "sandbox",
  name: "feature-auth",
  branch: "opencode/feature-auth",
  directory: "/project/feature-auth",
  extra: null,
  projectID: "proj1",
}

describe("wsName", () => {
  it("returns custom name when present in names map", () => {
    expect(wsName(base, { "ws-1": "My Feature" })).toBe("My Feature")
  })

  it("falls back to ws.name when no custom name", () => {
    expect(wsName(base, {})).toBe("feature-auth")
  })

  it("falls back to ws.branch when name is null", () => {
    const ws = { ...base, name: null as unknown as string }
    expect(wsName(ws, {})).toBe("opencode/feature-auth")
  })

  it("falls back to ws.id when name and branch are null", () => {
    const ws = { ...base, name: null as unknown as string, branch: null }
    expect(wsName(ws, {})).toBe("ws-1")
  })

  it("custom name takes precedence over all fallbacks", () => {
    const ws = { ...base, name: null as unknown as string, branch: null }
    expect(wsName(ws, { "ws-1": "Override" })).toBe("Override")
  })

  it("handles empty names map", () => {
    expect(wsName(base, {})).toBe("feature-auth")
  })
})

describe("isLocal", () => {
  it("returns true for type=local", () => {
    expect(isLocal({ ...base, type: "local" })).toBe(true)
  })

  it("returns false for type=sandbox", () => {
    expect(isLocal(base)).toBe(false)
  })

  it("returns false for type=remote", () => {
    expect(isLocal({ ...base, type: "remote" })).toBe(false)
  })

  it("returns false for empty string type", () => {
    expect(isLocal({ ...base, type: "" })).toBe(false)
  })
})

describe("shortDir", () => {
  const originalHome = process.env.HOME

  beforeEach(() => {
    process.env.HOME = "/Users/alice"
  })

  afterEach(() => {
    process.env.HOME = originalHome
  })

  it("replaces HOME prefix with ~", () => {
    expect(shortDir("/Users/alice/code/project")).toBe("~/code/project")
  })

  it("returns directory unchanged when no HOME prefix", () => {
    expect(shortDir("/var/data/project")).toBe("/var/data/project")
  })

  it("returns empty string for null", () => {
    expect(shortDir(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(shortDir(undefined)).toBe("")
  })

  it("returns empty string for empty string", () => {
    expect(shortDir("")).toBe("")
  })

  it("handles exact HOME directory", () => {
    expect(shortDir("/Users/alice")).toBe("~")
  })

  it("handles HOME not set", () => {
    process.env.HOME = ""
    expect(shortDir("/Users/alice/code")).toBe("/Users/alice/code")
  })
})

describe("relativeTime", () => {
  const now = () => Math.floor(Date.now() / 1000)

  it("returns 'just now' for < 1 minute ago", () => {
    expect(relativeTime(now() - 30)).toBe("just now")
  })

  it("returns 'Xm ago' for minutes", () => {
    expect(relativeTime(now() - 5 * 60)).toBe("5m ago")
  })

  it("returns '1m ago' for exactly 1 minute", () => {
    expect(relativeTime(now() - 60)).toBe("1m ago")
  })

  it("returns '59m ago' for 59 minutes", () => {
    expect(relativeTime(now() - 59 * 60)).toBe("59m ago")
  })

  it("returns 'Xh ago' for hours", () => {
    expect(relativeTime(now() - 3 * 3600)).toBe("3h ago")
  })

  it("returns '1h ago' for exactly 1 hour", () => {
    expect(relativeTime(now() - 3600)).toBe("1h ago")
  })

  it("returns '23h ago' for 23 hours", () => {
    expect(relativeTime(now() - 23 * 3600)).toBe("23h ago")
  })

  it("returns 'yesterday' for ~1 day ago", () => {
    expect(relativeTime(now() - 24 * 3600)).toBe("yesterday")
  })

  it("returns 'Xd ago' for 2-6 days", () => {
    expect(relativeTime(now() - 3 * 24 * 3600)).toBe("3d ago")
  })

  it("returns '6d ago' for 6 days", () => {
    expect(relativeTime(now() - 6 * 24 * 3600)).toBe("6d ago")
  })

  it("returns formatted date for >= 7 days", () => {
    // 7 days ago — should be something like "Apr 8" (locale-dependent format)
    const result = relativeTime(now() - 7 * 24 * 3600)
    expect(result).toMatch(/^[A-Z][a-z]+ \d+$/)
  })
})
