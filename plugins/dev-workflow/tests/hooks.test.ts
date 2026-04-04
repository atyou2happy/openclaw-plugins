import { describe, expect, it, vi } from "vitest";

vi.mock("openclaw/plugin-sdk/core", () => ({}));

describe("registerDevWorkflowHooks", () => {
  it("registers 4 hooks without errors", async () => {
    const { registerDevWorkflowHooks } = await import("../src/hooks/index.js");
    const registerHook = vi.fn();
    const api = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerHook,
    } as any;
    registerDevWorkflowHooks(api);
    expect(registerHook).toHaveBeenCalledTimes(4);
    expect(registerHook).toHaveBeenCalledWith("session_start", expect.any(Function), { name: "dev-workflow-session-start" });
    expect(registerHook).toHaveBeenCalledWith("session_end", expect.any(Function), { name: "dev-workflow-session-end" });
    expect(registerHook).toHaveBeenCalledWith("before_tool_call", expect.any(Function), { name: "dev-workflow-before-tool-call" });
    expect(registerHook).toHaveBeenCalledWith("after_tool_call", expect.any(Function), { name: "dev-workflow-after-tool-call" });
  });

  it("session_start hook logs session key", async () => {
    const { registerDevWorkflowHooks } = await import("../src/hooks/index.js");
    const registerHook = vi.fn();
    const loggerInfo = vi.fn();
    const api = {
      logger: { info: loggerInfo, warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      registerHook,
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
    } as any;
    registerDevWorkflowHooks(api);

    const handler = registerHook.mock.calls.find((c: any) => c[0] === "session_end")![1];
    await handler({ sessionKey: "end-session" });
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining("end-session"));
  });
});
