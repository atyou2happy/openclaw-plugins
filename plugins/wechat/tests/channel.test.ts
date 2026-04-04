import { describe, expect, it } from "vitest";
import { wechatPlugin } from "../src/channel.js";

const p = wechatPlugin as any;

describe("wechatPlugin", () => {
  it("is defined", () => {
    expect(wechatPlugin).toBeDefined();
  });

  it("has id equal to 'wechat'", () => {
    expect(p.id).toBe("wechat");
  });

  it("has meta with required fields", () => {
    expect(p.meta.id).toBe("wechat");
    expect(p.meta.label).toBe("WeChat");
    expect(p.meta.selectionLabel).toBe("WeChat / 微信");
    expect(p.meta.docsPath).toBe("/channels/wechat");
    expect(p.meta.blurb).toBeTruthy();
  });

  it("declares direct chat capability", () => {
    expect(p.capabilities.chatTypes).toContain("direct");
    expect(p.capabilities.media).toBe(true);
    expect(p.capabilities.reply).toBe(true);
  });

  it("has configSchema with safeParse", () => {
    expect(typeof p.configSchema?.safeParse).toBe("function");
  });

  it("has gateway with startAccount", () => {
    expect(typeof p.gateway?.startAccount).toBe("function");
  });

  it("has actions with describeMessageTool and handleAction", () => {
    expect(typeof p.actions?.describeMessageTool).toBe("function");
    expect(typeof p.actions?.handleAction).toBe("function");
  });

  it("has status with probeAccount", () => {
    expect(typeof p.status?.probeAccount).toBe("function");
  });

  it("has messaging with normalizeTarget", () => {
    expect(typeof p.messaging?.normalizeTarget).toBe("function");
  });

  it("normalizeTarget trims whitespace", () => {
    expect(p.messaging.normalizeTarget("  user123  ")).toBe("user123");
  });

  it("normalizeTarget returns undefined for empty string", () => {
    expect(p.messaging.normalizeTarget("   ")).toBeUndefined();
    expect(p.messaging.normalizeTarget("")).toBeUndefined();
  });

  it("has pairing config", () => {
    expect(p.pairing.idLabel).toBe("wechatUserId");
    expect(typeof p.pairing.notifyApproval).toBe("function");
    expect(typeof p.pairing.normalizeAllowEntry).toBe("function");
  });

  it("has outbound config", () => {
    expect(p.outbound.deliveryMode).toBe("direct");
    expect(typeof p.outbound.chunker).toBe("function");
    expect(p.outbound.textChunkLimit).toBe(2000);
    expect(typeof p.outbound.sendText).toBe("function");
    expect(typeof p.outbound.sendMedia).toBe("function");
  });

  it("describeMessageTool returns correct structure", () => {
    const result = p.actions.describeMessageTool({});
    expect(result.actions).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(result.schema).toBeDefined();
  });
});
