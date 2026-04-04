import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (config: any) => config,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => "abc12345"),
    })),
  })),
}));

describe("openharness-memory", () => {
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
    expect(plugin.id).toBe("openharness-memory");
    expect(plugin.name).toBe("OpenHarness Memory");
    expect(plugin.description).toContain("Persistent");
  });

  it("should register memory tools when register() is called", () => {
    plugin.register(api);
    expect(api.registerTool).toHaveBeenCalledTimes(5);
  });

  it("should register oh_memory_add tool", () => {
    plugin.register(api);
    const addTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_memory_add");
    expect(addTool).toBeDefined();
    expect(addTool[0].description).toContain("Add a memory");
    expect(addTool[0].parameters.properties).toHaveProperty("title");
    expect(addTool[0].parameters.properties).toHaveProperty("content");
  });

  it("should register oh_memory_list tool", () => {
    plugin.register(api);
    const listTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_memory_list");
    expect(listTool).toBeDefined();
    expect(listTool[0].description).toContain("List all memory");
  });

  it("should register oh_memory_search tool", () => {
    plugin.register(api);
    const searchTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_memory_search");
    expect(searchTool).toBeDefined();
    expect(searchTool[0].parameters.properties).toHaveProperty("query");
  });

  it("should register oh_memory_remove tool", () => {
    plugin.register(api);
    const removeTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_memory_remove");
    expect(removeTool).toBeDefined();
    expect(removeTool[0].parameters.properties).toHaveProperty("title");
  });

  it("should register oh_memory_view tool", () => {
    plugin.register(api);
    const viewTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_memory_view");
    expect(viewTool).toBeDefined();
    expect(viewTool[0].description).toContain("MEMORY.md");
  });

  it("should register before_prompt_build hook for auto-loading memories", () => {
    plugin.register(api);
    expect(api.on).toHaveBeenCalledWith("before_prompt_build", expect.any(Function));
  });

  it("oh_memory_list returns no memories message when directory is empty", async () => {
    plugin.register(api);
    const listTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_memory_list")[0];
    const result = await listTool.execute("id", {}, {});
    expect(result.content[0].text).toContain("No memory entries");
  });

  it("oh_memory_view returns no index message when no MEMORY.md exists", async () => {
    plugin.register(api);
    const viewTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_memory_view")[0];
    const result = await viewTool.execute("id", {}, {});
    expect(result.content[0].text).toContain("No MEMORY.md");
  });
});
