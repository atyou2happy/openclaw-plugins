import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearClientCache } from "../src/client.js";
import { sendMessageWeChat, sendTypingWeChat } from "../src/send.js";
import type { ResolvedWeChatAccount } from "../src/types.js";

const officialAccount: ResolvedWeChatAccount = {
  accountId: "default",
  selectionSource: "default",
  enabled: true,
  configured: true,
  platform: "official",
  official: {
    appId: "wx_test",
    appSecret: "test_secret",
    token: "test_token",
  },
  wecom: null,
  config: {} as any,
};

const wecomAccount: ResolvedWeChatAccount = {
  accountId: "wecom_default",
  selectionSource: "default",
  enabled: true,
  configured: true,
  platform: "wecom",
  official: null,
  wecom: {
    corpid: "corp_test",
    corpsecret: "corp_secret",
    agentid: 100,
    token: "wecom_token",
  },
  config: {} as any,
};

describe("sendMessageWeChat", () => {
  beforeEach(() => {
    clearClientCache();
  });

  it("sends message via official account client", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ access_token: "tok", expires_in: 7200 }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ msgid: "wx_msg_001" }),
        }),
    );

    const result = await sendMessageWeChat({
      account: officialAccount,
      to: "oUser123",
      text: "Hello from official",
    });

    expect(result.messageId).toBe("wx_msg_001");
    expect(result.chatId).toBe("oUser123");
    vi.restoreAllMocks();
  });

  it("sends message via wecom client", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ errcode: 0, access_token: "wecom_tok", expires_in: 7200 }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ msgid: "wc_msg_001" }),
        }),
    );

    const result = await sendMessageWeChat({
      account: wecomAccount,
      to: "UserID",
      text: "Hello from wecom",
    });

    expect(result.messageId).toBe("wc_msg_001");
    expect(result.chatId).toBe("UserID");
    vi.restoreAllMocks();
  });

  it("throws on official account API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ access_token: "tok", expires_in: 7200 }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ errcode: 45015, errmsg: "response timeout" }),
        }),
    );

    await expect(
      sendMessageWeChat({ account: officialAccount, to: "oUser", text: "test" }),
    ).rejects.toThrow(/WeChat send error/);
    vi.restoreAllMocks();
  });

  it("throws on wecom API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ errcode: 0, access_token: "tok", expires_in: 7200 }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ errcode: 60011, errmsg: "no permission" }),
        }),
    );

    await expect(
      sendMessageWeChat({ account: wecomAccount, to: "UserID", text: "test" }),
    ).rejects.toThrow(/WeCom send error/);
    vi.restoreAllMocks();
  });

  it("throws for unconfigured account", async () => {
    const unconfiguredAccount: ResolvedWeChatAccount = {
      accountId: "bad",
      selectionSource: "default",
      enabled: true,
      configured: false,
      platform: "official",
      official: null,
      wecom: null,
      config: {} as any,
    };

    await expect(
      sendMessageWeChat({ account: unconfiguredAccount, to: "user", text: "test" }),
    ).rejects.toThrow(/not properly configured/);
  });

  it("generates fallback messageId when API returns no msgid", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ access_token: "tok", expires_in: 7200 }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ errcode: 0 }),
        }),
    );

    const result = await sendMessageWeChat({
      account: officialAccount,
      to: "oUser",
      text: "test",
    });

    expect(result.messageId).toMatch(/^wx_/);
    vi.restoreAllMocks();
  });
});

describe("sendTypingWeChat", () => {
  it("does nothing (no-op)", async () => {
    await expect(
      sendTypingWeChat({ account: officialAccount, to: "oUser" }),
    ).resolves.toBeUndefined();
  });
});
