import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

vi.mock("../src/channel/runtime.js", () => ({
  getEngine: vi.fn(() => ({
    getContext: vi.fn(() => null),
    getHandoverManager: vi.fn(() => ({
      consume: vi.fn().mockResolvedValue(null),
      generate: vi.fn().mockResolvedValue(""),
    })),
    getMemdirManager: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      updateAging: vi.fn().mockResolvedValue(undefined),
      recall: vi.fn().mockResolvedValue([]),
      remember: vi.fn().mockResolvedValue({}),
    })),
    getBootstrapManager: vi.fn(() => ({
      bootstrap: vi.fn().mockResolvedValue({ checks: [], suggestions: [] }),
    })),
    getFeatureFlagManager: vi.fn(() => ({
      scanForFlags: vi.fn().mockResolvedValue([]),
      detectCleanupCandidates: vi.fn().mockResolvedValue([]),
    })),
    getPermissionManager: vi.fn(() => ({
      upgradeToWorkspaceWrite: vi.fn(),
      canWrite: vi.fn().mockReturnValue(true),
      validateOperation: vi.fn().mockReturnValue({ allowed: true }),
    })),
    getWorkingMemoryManager: vi.fn(() => ({
      shouldCompact: vi.fn().mockReturnValue({ needed: false }),
      executeL1Compact: vi.fn().mockResolvedValue(undefined),
      executeL2Compact: vi.fn().mockResolvedValue(undefined),
    })),
  })),
}));

vi.mock("../src/agents/verification-agent.js", () => ({
  VerificationAgent: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue({ verdict: "PASS", issues: [], formatReport: vi.fn().mockReturnValue("") }),
  })),
}));

vi.mock("../src/handover/index.js", () => ({
  HandoverManager: vi.fn().mockImplementation(() => ({
    consume: vi.fn().mockResolvedValue(null),
    generate: vi.fn().mockResolvedValue(""),
  })),
}));

vi.mock("../src/memdir/index.js", () => ({
  MemdirManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    updateAging: vi.fn().mockResolvedValue(undefined),
    recall: vi.fn().mockResolvedValue([]),
    remember: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("../src/bootstrap/index.js", () => ({
  BootstrapManager: vi.fn().mockImplementation(() => ({
    bootstrap: vi.fn().mockResolvedValue({ checks: [], suggestions: [] }),
  })),
}));

vi.mock("../src/feature-flags/index.js", () => ({
  FeatureFlagManager: vi.fn().mockImplementation(() => ({
    scanForFlags: vi.fn().mockResolvedValue([]),
    detectCleanupCandidates: vi.fn().mockResolvedValue([]),
  })),
}));

describe("registerDevWorkflowHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers hooks without errors", async () => {
    const { registerDevWorkflowHooks } = await import("../src/hooks/index.js");
    const registerHook = vi.fn();
    const api = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerHook,
      runtime: { logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } },
    } as any;
    registerDevWorkflowHooks(api);
    expect(registerHook).toHaveBeenCalled();
    const hookNames = registerHook.mock.calls.map((c: any) => c[2]?.name);
    expect(hookNames).toContain("dev-workflow-session-start");
    expect(hookNames).toContain("dev-workflow-session-end");
    expect(hookNames).toContain("dev-workflow-before-tool-call");
    expect(hookNames).toContain("dev-workflow-after-tool-call");
    expect(hookNames).toContain("dev-workflow-task-completed");
    expect(hookNames).toContain("dev-workflow-bootstrap");
    expect(hookNames).toContain("dev-workflow-delivery");
  });

  it("session_start hook logs session key", async () => {
    const { registerDevWorkflowHooks } = await import("../src/hooks/index.js");
    const registerHook = vi.fn();
    const loggerInfo = vi.fn();
    const api = {
      logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerHook,
      runtime: { logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } },
    } as any;
    registerDevWorkflowHooks(api);

    const sessionStartHandler = registerHook.mock.calls.find((c: any) => c[0] === "session_start")![1];
    await sessionStartHandler({ sessionKey: "test-session" });
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("test-session"));
  });

  it("before_tool_call hook logs tool name", async () => {
    const { registerDevWorkflowHooks } = await import("../src/hooks/index.js");
    const registerHook = vi.fn();
    const loggerInfo = vi.fn();
    const api = {
      logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerHook,
      runtime: { logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } },
    } as any;
    registerDevWorkflowHooks(api);

    const handler = registerHook.mock.calls.find((c: any) => c[0] === "before_tool_call")![1];
    await handler({ toolName: "dev_workflow_start" });
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("dev_workflow_start"));
  });

  it("after_tool_call hook logs tool name", async () => {
    const { registerDevWorkflowHooks } = await import("../src/hooks/index.js");
    const registerHook = vi.fn();
    const loggerInfo = vi.fn();
    const api = {
      logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerHook,
      runtime: { logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } },
    } as any;
    registerDevWorkflowHooks(api);

    const handler = registerHook.mock.calls.find((c: any) => c[0] === "after_tool_call")![1];
    await handler({ toolName: "qa_gate_check" });
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("qa_gate_check"));
  });

  it("session_end hook logs session key", async () => {
    const { registerDevWorkflowHooks } = await import("../src/hooks/index.js");
    const registerHook = vi.fn();
    const loggerInfo = vi.fn();
    const api = {
      logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerHook,
      runtime: { logging: { getChildLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } },
    } as any;
    registerDevWorkflowHooks(api);

    const handler = registerHook.mock.calls.find((c: any) => c[0] === "session_end")![1];
    await handler({ sessionKey: "end-session" });
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("end-session"));
  });
});
