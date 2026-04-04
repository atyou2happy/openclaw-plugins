import { describe, expect, it } from "vitest";

describe("index.ts re-exports", () => {
  it("re-exports wechatPlugin from channel module", async () => {
    const { wechatPlugin } = await import("../src/channel.js");
    const indexMod = await import("../index.js");

    expect(indexMod.wechatPlugin).toBe(wechatPlugin);
    expect((indexMod.wechatPlugin as any).id).toBe("wechat");
  });

  it("re-exports setWeChatRuntime from runtime module", async () => {
    const indexMod = await import("../index.js");
    expect(typeof indexMod.setWeChatRuntime).toBe("function");
  });
});
