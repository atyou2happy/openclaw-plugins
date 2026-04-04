import { describe, expect, it, vi } from "vitest";

vi.mock("openclaw/plugin-sdk/core", () => ({
  defineChannelPluginEntry: (opts: any) => opts,
  createChannelPluginBase: (opts: any) => opts,
}));

describe("plugin entry point", () => {
  it("exports plugin with correct id", async () => {
    const plugin = (await import("../src/index.js")).default;
    expect(plugin.id).toBe("dev-workflow");
    expect(plugin.name).toBe("Dev Workflow");
  });

  it("has registerFull that calls tool and hook registration", async () => {
    const plugin = (await import("../src/index.js")).default;
    const registerTool = vi.fn();
    const registerHook = vi.fn();
    const api = {
      registerTool,
      registerHook,
      registerHttpRoute: vi.fn(),
      registerChannel: vi.fn(),
      registerGatewayMethod: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn(),
      registerCliBackend: vi.fn(),
      registerProvider: vi.fn(),
      registerSpeechProvider: vi.fn(),
      registerMediaUnderstandingProvider: vi.fn(),
      registerImageGenerationProvider: vi.fn(),
      registerWebFetchProvider: vi.fn(),
      registerWebSearchProvider: vi.fn(),
      registerInteractiveHandler: vi.fn(),
      onConversationBindingResolved: vi.fn(),
      registerCommand: vi.fn(),
      registerContextEngine: vi.fn(),
      registerMemoryPromptSection: vi.fn(),
      registerMemoryFlushPlan: vi.fn(),
      registerMemoryRuntime: vi.fn(),
      registerMemoryEmbeddingProvider: vi.fn(),
      resolvePath: vi.fn(),
      on: vi.fn(),
    } as any;
    plugin.registerFull(api);
    expect(registerTool).toHaveBeenCalled();
    expect(registerHook).toHaveBeenCalled();
  });

  it("exports named exports", async () => {
    const mod = await import("../src/index.js");
    expect(mod.devWorkflowChannel).toBeDefined();
    expect(mod.setDevWorkflowRuntime).toBeDefined();
    expect(mod.DevWorkflowEngine).toBeDefined();
    expect(mod.AgentOrchestrator).toBeDefined();
  });
});
