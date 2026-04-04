import { describe, expect, it } from "vitest";
import { resolveWeChatAccount, listConfiguredWeChatAccountIds } from "../src/accounts.js";

function makeCfg(channels: Record<string, unknown>) {
  return { channels } as Record<string, unknown>;
}

describe("resolveWeChatAccount", () => {
  it("resolves default account with official platform", () => {
    const cfg = makeCfg({
      wechat: {
        platform: "official",
        appId: "wx_default",
        appSecret: "default_secret",
        token: "default_token",
      },
    });

    const account = resolveWeChatAccount(cfg);
    expect(account.accountId).toBe("default");
    expect(account.selectionSource).toBe("default");
    expect(account.platform).toBe("official");
    expect(account.enabled).toBe(true);
    expect(account.configured).toBe(true);
    expect(account.official).toEqual({
      appId: "wx_default",
      appSecret: "default_secret",
      token: "default_token",
      encodingAESKey: undefined,
    });
    expect(account.wecom).toBeNull();
  });

  it("resolves default account with wecom platform", () => {
    const cfg = makeCfg({
      wechat: {
        platform: "wecom",
        corpid: "corp123",
        corpsecret: "corpsecret123",
        agentid: 100,
        token: "wecom_token",
      },
    });

    const account = resolveWeChatAccount(cfg);
    expect(account.platform).toBe("wecom");
    expect(account.configured).toBe(true);
    expect(account.wecom).toEqual({
      corpid: "corp123",
      corpsecret: "corpsecret123",
      agentid: 100,
      token: "wecom_token",
      encodingAESKey: undefined,
    });
    expect(account.official).toBeNull();
  });

  it("infers platform from corpid when platform not set", () => {
    const cfg = makeCfg({
      wechat: {
        corpid: "corp_auto",
        corpsecret: "secret_auto",
        agentid: 50,
        token: "auto_token",
      },
    });

    const account = resolveWeChatAccount(cfg);
    expect(account.platform).toBe("wecom");
    expect(account.configured).toBe(true);
  });

  it("defaults to official platform when no platform or corpid", () => {
    const cfg = makeCfg({
      wechat: {
        appId: "wx_auto",
        appSecret: "secret_auto",
        token: "auto_token",
      },
    });

    const account = resolveWeChatAccount(cfg);
    expect(account.platform).toBe("official");
  });

  it("resolves named account from accounts map", () => {
    const cfg = makeCfg({
      wechat: {
        platform: "official",
        appId: "wx_top",
        appSecret: "top_secret",
        token: "top_token",
        accounts: {
          named: {
            appId: "wx_named",
            appSecret: "named_secret",
            token: "named_token",
          },
        },
      },
    });

    const account = resolveWeChatAccount(cfg, "named");
    expect(account.accountId).toBe("named");
    expect(account.selectionSource).toBe("named");
    expect(account.configured).toBe(true);
    expect(account.official?.appId).toBe("wx_named");
  });

  it("throws for missing named account", () => {
    const cfg = makeCfg({
      wechat: {
        accounts: {},
      },
    });

    expect(() => resolveWeChatAccount(cfg, "nonexistent")).toThrow(/not found/);
  });

  it("marks unconfigured account when credentials are missing", () => {
    const cfg = makeCfg({
      wechat: {
        platform: "official",
      },
    });

    const account = resolveWeChatAccount(cfg);
    expect(account.configured).toBe(false);
    expect(account.official).toBeNull();
  });

  it("respects enabled: false", () => {
    const cfg = makeCfg({
      wechat: {
        enabled: false,
        platform: "official",
        appId: "wx_disabled",
        appSecret: "secret",
        token: "tok",
      },
    });

    const account = resolveWeChatAccount(cfg);
    expect(account.enabled).toBe(false);
    expect(account.configured).toBe(true);
  });

  it("handles missing wechat config gracefully", () => {
    const cfg = makeCfg({});
    const account = resolveWeChatAccount(cfg);
    expect(account.accountId).toBe("default");
    expect(account.configured).toBe(false);
    expect(account.platform).toBe("official");
  });
});

describe("listConfiguredWeChatAccountIds", () => {
  it("returns default for minimal config", () => {
    const ids = listConfiguredWeChatAccountIds({});
    expect(ids).toEqual(["default"]);
  });

  it("returns default for single account config", () => {
    const ids = listConfiguredWeChatAccountIds({
      channels: {
        wechat: {
          appId: "wx123",
          appSecret: "secret",
          token: "tok",
        },
      },
    });
    expect(ids).toEqual(["default"]);
  });

  it("returns account ids from accounts map", () => {
    const ids = listConfiguredWeChatAccountIds({
      channels: {
        wechat: {
          accounts: {
            main: { appId: "wx_main", appSecret: "s1", token: "t1" },
            backup: { corpid: "c1", corpsecret: "s2", agentid: 1, token: "t2" },
          },
        },
      },
    });
    expect(ids.sort()).toEqual(["backup", "main"].sort());
  });
});
