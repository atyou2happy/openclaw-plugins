import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (config: any) => config,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
  spawn: vi.fn(() => ({
    pid: 12345,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  })),
}));

describe("openharness-swarm", () => {
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
    expect(plugin.id).toBe("openharness-swarm");
    expect(plugin.name).toBe("OpenHarness Swarm");
    expect(plugin.description).toContain("Multi-agent");
  });

  it("should register swarm tools when register() is called", () => {
    plugin.register(api);
    expect(api.registerTool).toHaveBeenCalled();
  });

  it("should register oh_swarm_spawn tool", () => {
    plugin.register(api);
    const spawnTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_spawn");
    expect(spawnTool).toBeDefined();
    expect(spawnTool[0].description).toContain("Spawn a subagent");
    expect(typeof spawnTool[0].execute).toBe("function");
  });

  it("should register oh_swarm_list tool", () => {
    plugin.register(api);
    const listTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_list");
    expect(listTool).toBeDefined();
    expect(listTool[0].description).toContain("List all spawned");
  });

  it("should register oh_swarm_status tool", () => {
    plugin.register(api);
    const statusTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_status");
    expect(statusTool).toBeDefined();
    expect(statusTool[0].parameters.properties).toHaveProperty("agent_id");
  });

  it("should register oh_swarm_stop tool", () => {
    plugin.register(api);
    const stopTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_stop");
    expect(stopTool).toBeDefined();
    expect(stopTool[0].description).toContain("Stop a running");
  });

  it("should register team management tools", () => {
    plugin.register(api);
    const teamCreate = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_team_create");
    const teamList = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_team_list");
    expect(teamCreate).toBeDefined();
    expect(teamList).toBeDefined();
  });

  it("should register oh_swarm_send_message tool", () => {
    plugin.register(api);
    const msgTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_send_message");
    expect(msgTool).toBeDefined();
    expect(msgTool[0].parameters.properties).toHaveProperty("target");
    expect(msgTool[0].parameters.properties).toHaveProperty("message");
  });

  it("should register oh_swarm_delegate tool", () => {
    plugin.register(api);
    const delegateTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_delegate");
    expect(delegateTool).toBeDefined();
    expect(delegateTool[0].description).toContain("Delegate");
  });

  it("oh_swarm_list returns no agents message when none exist", async () => {
    plugin.register(api);
    const listTool = api.registerTool.mock.calls.find((c: any[]) => c[0].name === "oh_swarm_list")[0];
    const result = await listTool.execute("id", {}, {});
    expect(result.content[0].text).toContain("No subagents");
  });
});
