import { describe, expect, it, vi } from "vitest";

vi.mock("openclaw/plugin-sdk/core", () => ({
  createChannelPluginBase: (opts: any) => opts,
  defineChannelPluginEntry: (opts: any) => opts,
}));

import { devWorkflowChannel } from "../src/channel/dev-workflow-channel.js";

describe("devWorkflowChannel", () => {
  it("has correct channel id", () => {
    expect(devWorkflowChannel.id).toBe("dev-workflow");
  });

  it("has meta with expected properties", () => {
    expect(devWorkflowChannel.meta.id).toBe("dev-workflow");
    expect(devWorkflowChannel.meta.label).toBe("Dev Workflow");
    expect(devWorkflowChannel.meta.aliases).toEqual(["dwf", "devflow"]);
    expect(devWorkflowChannel.meta.order).toBe(50);
    expect(devWorkflowChannel.meta.quickstartAllowFrom).toBe(true);
  });

  it("has capabilities configured", () => {
    expect(devWorkflowChannel.capabilities.chatTypes).toEqual(["direct"]);
    expect(devWorkflowChannel.capabilities.nativeCommands).toBe(true);
    expect(devWorkflowChannel.capabilities.media).toBe(true);
  });

  it("setup.applyAccountConfig returns config unchanged", () => {
    const cfg = { foo: "bar" } as any;
    const result = devWorkflowChannel.setup.applyAccountConfig({ cfg, accountId: "test", input: {} });
    expect(result).toBe(cfg);
  });

  it("config.listAccountIds extracts keys from channel config", () => {
    const cfg = {
      channels: {
        "dev-workflow": {
          account1: { enabled: true },
          account2: { enabled: false },
          allowFrom: ["*"],
        },
      },
    } as any;
    const ids = devWorkflowChannel.config.listAccountIds(cfg);
    expect(ids).toContain("account1");
    expect(ids).toContain("account2");
    expect(ids).not.toContain("allowFrom");
  });

  it("config.resolveAccount returns default when no accountId", () => {
    const cfg = {} as any;
    const account = devWorkflowChannel.config.resolveAccount(cfg, null);
    expect(account.accountId).toBe("default");
    expect(account.enabled).toBe(true);
  });

  it("config.resolveAccount uses provided accountId", () => {
    const account = devWorkflowChannel.config.resolveAccount({} as any, "custom-id");
    expect(account.accountId).toBe("custom-id");
  });

  it("config.isEnabled returns true for enabled accounts", () => {
    expect(devWorkflowChannel.config.isEnabled({ accountId: "a", enabled: true })).toBe(true);
  });

  it("config.isEnabled returns false for disabled accounts", () => {
    expect(devWorkflowChannel.config.isEnabled({ accountId: "a", enabled: false })).toBe(false);
  });

  it("config.isConfigured always returns true", () => {
    expect(devWorkflowChannel.config.isConfigured({} as any)).toBe(true);
  });
});
