import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (config: any) => config,
}));

describe("openharness-tools", () => {
  let plugin: any;
  let api: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../src/index.js");
    plugin = mod.default;
    api = {
      registerTool: vi.fn(),
    };
  });

  it("should have correct plugin metadata", () => {
    expect(plugin.id).toBe("openharness-tools");
    expect(plugin.name).toBe("OpenHarness Tools");
    expect(plugin.description).toContain("OpenHarness tools");
  });

  it("should register tools when register() is called", () => {
    plugin.register(api);
    expect(api.registerTool).toHaveBeenCalled();
  });

  it("should register file I/O tools", () => {
    plugin.register(api);
    const registeredNames = api.registerTool.mock.calls.map((c: any[]) => c[0].name);
    expect(registeredNames).toContain("oh_bash");
    expect(registeredNames).toContain("oh_file_read");
    expect(registeredNames).toContain("oh_file_write");
    expect(registeredNames).toContain("oh_file_edit");
  });

  it("should register search and web tools", () => {
    plugin.register(api);
    const registeredNames = api.registerTool.mock.calls.map((c: any[]) => c[0].name);
    expect(registeredNames).toContain("oh_glob");
    expect(registeredNames).toContain("oh_grep");
    expect(registeredNames).toContain("oh_web_fetch");
    expect(registeredNames).toContain("oh_web_search");
  });

  it("should register workflow and coordination tools", () => {
    plugin.register(api);
    const registeredNames = api.registerTool.mock.calls.map((c: any[]) => c[0].name);
    expect(registeredNames).toContain("oh_skill");
    expect(registeredNames).toContain("oh_config");
    expect(registeredNames).toContain("oh_todo_write");
    expect(registeredNames).toContain("oh_enter_plan_mode");
    expect(registeredNames).toContain("oh_exit_plan_mode");
  });

  it("should register agent, team, and cron tools", () => {
    plugin.register(api);
    const registeredNames = api.registerTool.mock.calls.map((c: any[]) => c[0].name);
    expect(registeredNames).toContain("oh_agent_spawn");
    expect(registeredNames).toContain("oh_team_list");
    expect(registeredNames).toContain("oh_cron_list");
  });

  it("each registered tool should have name, description, parameters, and execute", () => {
    plugin.register(api);
    for (const [tool] of api.registerTool.mock.calls) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("parameters");
      expect(tool).toHaveProperty("execute");
      expect(typeof tool.execute).toBe("function");
    }
  });
});
