import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openclaw/plugin-sdk/plugin-entry", () => ({
  definePluginEntry: (config: any) => config,
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  access: vi.fn(),
}));

describe("openharness-commands", () => {
  let plugin: any;
  let api: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../src/index.js");
    plugin = mod.default;
    api = {
      registerCommand: vi.fn(),
    };
  });

  it("should have correct plugin metadata", () => {
    expect(plugin.id).toBe("openharness-commands");
    expect(plugin.name).toBe("OpenHarness Commands");
    expect(plugin.description).toContain("Slash commands");
  });

  it("should register commands when register() is called", () => {
    plugin.register(api);
    expect(api.registerCommand).toHaveBeenCalled();
  });

  it("should register oh-help command", () => {
    plugin.register(api);
    const helpCmd = api.registerCommand.mock.calls.find((c: any[]) => c[0].name === "oh-help");
    expect(helpCmd).toBeDefined();
    expect(helpCmd[0].description).toContain("help");
    expect(typeof helpCmd[0].handler).toBe("function");
  });

  it("should register oh-status command", () => {
    plugin.register(api);
    const statusCmd = api.registerCommand.mock.calls.find((c: any[]) => c[0].name === "oh-status");
    expect(statusCmd).toBeDefined();
    expect(statusCmd[0].description).toContain("status");
  });

  it("should register oh-model command", () => {
    plugin.register(api);
    const modelCmd = api.registerCommand.mock.calls.find((c: any[]) => c[0].name === "oh-model");
    expect(modelCmd).toBeDefined();
    expect(modelCmd[0].description).toContain("model");
  });

  it("should register oh-doctor command", () => {
    plugin.register(api);
    const doctorCmd = api.registerCommand.mock.calls.find((c: any[]) => c[0].name === "oh-doctor");
    expect(doctorCmd).toBeDefined();
    expect(doctorCmd[0].description).toContain("diagnostics");
  });

  it("should register git-related commands", () => {
    plugin.register(api);
    const names = api.registerCommand.mock.calls.map((c: any[]) => c[0].name);
    expect(names).toContain("oh-diff");
    expect(names).toContain("oh-branch");
    expect(names).toContain("oh-commit");
  });

  it("should register session management commands", () => {
    plugin.register(api);
    const names = api.registerCommand.mock.calls.map((c: any[]) => c[0].name);
    expect(names).toContain("oh-resume");
    expect(names).toContain("oh-session");
    expect(names).toContain("oh-export");
    expect(names).toContain("oh-compact");
  });

  it("should register governance commands", () => {
    plugin.register(api);
    const names = api.registerCommand.mock.calls.map((c: any[]) => c[0].name);
    expect(names).toContain("oh-permissions");
    expect(names).toContain("oh-plan");
  });

  it("oh-help handler returns command list", async () => {
    plugin.register(api);
    const helpCmd = api.registerCommand.mock.calls.find((c: any[]) => c[0].name === "oh-help")[0];
    const result = await helpCmd.handler({ args: "" });
    expect(result.content[0].text).toContain("OpenHarness Commands");
    expect(result.content[0].text).toContain("/oh-status");
  });

  it("oh-status handler returns status info", async () => {
    plugin.register(api);
    const statusCmd = api.registerCommand.mock.calls.find((c: any[]) => c[0].name === "oh-status")[0];
    const result = await statusCmd.handler({ args: "" });
    expect(result.content[0].text).toContain("OpenHarness Session Status");
    expect(result.content[0].text).toContain("Tools:");
  });

  it("oh-commit handler returns usage message when no args", async () => {
    plugin.register(api);
    const commitCmd = api.registerCommand.mock.calls.find((c: any[]) => c[0].name === "oh-commit")[0];
    const result = await commitCmd.handler({ args: "" });
    expect(result.content[0].text).toContain("Usage:");
  });

  it("each registered command has name, description, and handler", () => {
    plugin.register(api);
    for (const [cmd] of api.registerCommand.mock.calls) {
      expect(cmd).toHaveProperty("name");
      expect(cmd).toHaveProperty("description");
      expect(cmd).toHaveProperty("handler");
      expect(typeof cmd.handler).toBe("function");
    }
  });
});
