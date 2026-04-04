import { describe, expect, it, vi } from "vitest";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

describe("runtime", () => {
  it("throws before initialization", async () => {
    const { getRuntime, getEngine, setDevWorkflowRuntime } = await import("../src/channel/runtime.js");
    const mod = await import("../src/channel/runtime.js");

    const freshModule = await vi.importActual("../src/channel/runtime.js") as any;
    
    const mockRuntime = {
      logging: { getChildLogger: vi.fn() },
      subagent: { run: vi.fn() },
    } as any;
    setDevWorkflowRuntime(mockRuntime);
    expect(getRuntime()).toBe(mockRuntime);
    expect(getEngine()).toBeDefined();
  });

  it("setDevWorkflowRuntime sets runtime and creates engine", async () => {
    const { setDevWorkflowRuntime, getRuntime, getEngine } = await import("../src/channel/runtime.js");
    const mockRuntime = {
      logging: { getChildLogger: vi.fn() },
      subagent: { run: vi.fn() },
    } as any;
    setDevWorkflowRuntime(mockRuntime);
    expect(getRuntime()).toBe(mockRuntime);
    expect(getEngine()).toBeDefined();
  });
});
