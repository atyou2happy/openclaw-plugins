import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (config: any) => config,
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe("openharness-governance", () => {
  let plugin: any;
  let api: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../src/index.js");
    plugin = mod.default;
    api = {
      registerTool: vi.fn(),
      on: vi.fn(),
    };
  });

  it("should have correct plugin metadata", () => {
    expect(plugin.id).toBe("openharness-governance");
    expect(plugin.name).toBe("OpenHarness Governance");
    expect(plugin.description).toContain("permissions");
  });

  it("should register oh_permissions tool", () => {
    plugin.register(api);
    const permTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_permissions");
    expect(permTool).toBeDefined();
    expect(permTool[0].description).toContain("View or modify governance");
    expect(typeof permTool[0].execute).toBe("function");
  });

  it("should register before_tool_call hook", () => {
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("before_tool_call", expect.any(Function));
  });

  it("should register after_tool_call hook", () => {
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("after_tool_call", expect.any(Function));
  });

  it("oh_permissions view action returns config", async () => {
    plugin.register(api);
    const permTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_permissions")[0];
    const result = await permTool.execute("id", { action: "view" }, {});
    expect(result.content[0].text).toContain("Governance Config");
    expect(result.content[0].text).toContain("Mode:");
  });

  it("oh_permissions set-mode validates invalid mode", async () => {
    plugin.register(api);
    const permTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_permissions")[0];
    const result = await permTool.execute("id", { action: "set-mode", value: "invalid" }, {});
    expect(result.content[0].text).toContain("Invalid mode");
  });

  it("before_tool_call hook blocks write tools in plan mode", async () => {
    plugin.register(api);
    const hook = api.on.mock.calls.find((c: any[]) => c[0] === "before_tool_call")[1];
    const result = await hook({ toolName: "oh_file_write", toolArgs: { file_path: "/tmp/test" } }, {});
    expect(result).toBeUndefined();
  });

  it("before_tool_call hook blocks denied commands", async () => {
    plugin.register(api);
    const hook = api.on.mock.calls.find((c: any[]) => c[0] === "before_tool_call")[1];
    const result = await hook({ toolName: "oh_bash", toolArgs: { command: "rm -rf /" } }, {});
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
  });

  it("before_tool_call hook blocks restricted paths", async () => {
    plugin.register(api);
    const hook = api.on.mock.calls.find((c: any[]) => c[0] === "before_tool_call")[1];
    const result = await hook({ toolName: "oh_file_write", toolArgs: { file_path: "/etc/passwd" } }, {});
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
  });
});
