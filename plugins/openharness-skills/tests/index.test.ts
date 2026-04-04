import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (config: any) => config,
}));

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

describe("openharness-skills", () => {
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
    expect(plugin.id).toBe("openharness-skills");
    expect(plugin.name).toBe("OpenHarness Skills");
    expect(plugin.description).toContain("skill loading");
  });

  it("should register skill tools when register() is called", () => {
    plugin.register(api);
    expect(api.registerTool).toHaveBeenCalledTimes(3);
  });

  it("should register oh_skill_list tool", () => {
    plugin.register(api);
    const listTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_skill_list");
    expect(listTool).toBeDefined();
    expect(listTool[0].description).toContain("List all available skills");
    expect(listTool[0].execute).toBeDefined();
    expect(typeof listTool[0].execute).toBe("function");
  });

  it("should register oh_skill_load tool", () => {
    plugin.register(api);
    const loadTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_skill_load");
    expect(loadTool).toBeDefined();
    expect(loadTool[0].description).toContain("Load a specific skill");
    expect(loadTool[0].parameters.properties).toHaveProperty("name");
  });

  it("should register oh_skill_search tool", () => {
    plugin.register(api);
    const searchTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_skill_search");
    expect(searchTool).toBeDefined();
    expect(searchTool[0].description).toContain("Search for skills");
    expect(searchTool[0].parameters.properties).toHaveProperty("query");
  });

  it("should register before_prompt_build hook", () => {
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("before_prompt_build", expect.any(Function));
  });

  it("oh_skill_list execute returns no skills message when none found", async () => {
    plugin.register(api);
    const listTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_skill_list")[0];
    const result = await listTool.execute("id", {}, {});
    expect(result.content[0].text).toContain("No skills installed");
  });
});
