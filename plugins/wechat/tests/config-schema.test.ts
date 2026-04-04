import { describe, expect, it } from "vitest";
import { WeChatConfigSchema, WeChatAccountConfigSchema } from "../src/config-schema.js";

function expectSchemaIssue(
  result: ReturnType<typeof WeChatConfigSchema.safeParse>,
  issuePath: string,
) {
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.some((issue) => issue.path.join(".") === issuePath)).toBe(true);
  }
}

describe("WeChatConfigSchema defaults", () => {
  it("parses empty config", () => {
    const result = WeChatConfigSchema.parse({});
    expect(result.enabled).toBeUndefined();
    expect(result.platform).toBeUndefined();
    expect(result.webhookPath).toBeUndefined();
    expect(result.dmPolicy).toBeUndefined();
  });

  it("parses full official account config", () => {
    const result = WeChatConfigSchema.parse({
      platform: "official",
      appId: "wx1234567890",
      appSecret: "secret123",
      token: "mytoken",
      encodingAESKey: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH",
      dmPolicy: "pairing",
    });

    expect(result.platform).toBe("official");
    expect(result.appId).toBe("wx1234567890");
    expect(result.appSecret).toBe("secret123");
    expect(result.token).toBe("mytoken");
    expect(result.encodingAESKey).toBe("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH");
    expect(result.dmPolicy).toBe("pairing");
  });

  it("parses full wecom config", () => {
    const result = WeChatConfigSchema.parse({
      platform: "wecom",
      corpid: "corpid123",
      corpsecret: "corpsecret123",
      agentid: 1000001,
      token: "mytoken",
    });

    expect(result.platform).toBe("wecom");
    expect(result.corpid).toBe("corpid123");
    expect(result.corpsecret).toBe("corpsecret123");
    expect(result.agentid).toBe(1000001);
  });
});

describe("WeChatConfigSchema shared fields", () => {
  it("accepts dmPolicy values", () => {
    for (const policy of ["open", "pairing", "allowlist", "disabled"] as const) {
      const result = WeChatConfigSchema.parse({ dmPolicy: policy });
      expect(result.dmPolicy).toBe(policy);
    }
  });

  it("accepts groupPolicy values", () => {
    for (const policy of ["open", "allowlist", "disabled"] as const) {
      const result = WeChatConfigSchema.parse({ groupPolicy: policy });
      expect(result.groupPolicy).toBe(policy);
    }
  });

  it("accepts replyToMode values", () => {
    for (const mode of ["thread", "flat"] as const) {
      const result = WeChatConfigSchema.parse({ replyToMode: mode });
      expect(result.replyToMode).toBe(mode);
    }
  });

  it("accepts allowFrom array", () => {
    const result = WeChatConfigSchema.parse({ allowFrom: ["user1", "user2"] });
    expect(result.allowFrom).toEqual(["user1", "user2"]);
  });

  it("accepts mediaMaxMb", () => {
    const result = WeChatConfigSchema.parse({ mediaMaxMb: 10 });
    expect(result.mediaMaxMb).toBe(10);
  });

  it("accepts webhookPort and webhookPath", () => {
    const result = WeChatConfigSchema.parse({ webhookPort: 8080, webhookPath: "/wx/callback" });
    expect(result.webhookPort).toBe(8080);
    expect(result.webhookPath).toBe("/wx/callback");
  });
});

describe("WeChatConfigSchema validation", () => {
  it("rejects invalid platform", () => {
    const result = WeChatConfigSchema.safeParse({ platform: "miniprogram" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dmPolicy", () => {
    const result = WeChatConfigSchema.safeParse({ dmPolicy: "anyone" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid groupPolicy", () => {
    const result = WeChatConfigSchema.safeParse({ groupPolicy: "anyone" });
    expect(result.success).toBe(false);
  });

  it("rejects negative mediaMaxMb", () => {
    const result = WeChatConfigSchema.safeParse({ mediaMaxMb: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer webhookPort", () => {
    const result = WeChatConfigSchema.safeParse({ webhookPort: 1.5 });
    expect(result.success).toBe(false);
  });

  it("requires appId for official platform at top level", () => {
    const result = WeChatConfigSchema.safeParse({
      platform: "official",
      appSecret: "secret123",
    });
    expectSchemaIssue(result, "appId");
  });

  it("requires appSecret for official platform at top level", () => {
    const result = WeChatConfigSchema.safeParse({
      platform: "official",
      appId: "wx1234567890",
    });
    expectSchemaIssue(result, "appSecret");
  });

  it("requires corpid for wecom platform at top level", () => {
    const result = WeChatConfigSchema.safeParse({
      platform: "wecom",
    });
    expectSchemaIssue(result, "corpid");
  });

  it("skips credential validation when accounts are defined", () => {
    const result = WeChatConfigSchema.safeParse({
      platform: "official",
      accounts: {
        main: {
          appId: "wx123",
          appSecret: "secret",
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("WeChatConfigSchema accounts", () => {
  it("parses accounts map", () => {
    const result = WeChatConfigSchema.parse({
      accounts: {
        main: {
          platform: "official",
          appId: "wx_main",
          appSecret: "secret_main",
          token: "token_main",
        },
        wecom: {
          platform: "wecom",
          corpid: "corp1",
          corpsecret: "secret1",
          agentid: 100,
        },
      },
    });

    expect(result.accounts?.main?.platform).toBe("official");
    expect(result.accounts?.wecom?.platform).toBe("wecom");
  });

  it("accepts defaultAccount", () => {
    const result = WeChatConfigSchema.parse({
      defaultAccount: "main",
      accounts: {
        main: { appId: "wx_main", appSecret: "secret_main" },
      },
    });

    expect(result.defaultAccount).toBe("main");
  });

  it("rejects unknown keys in strict mode", () => {
    const result = WeChatConfigSchema.safeParse({
      unknownField: "value",
    });
    expect(result.success).toBe(false);
  });
});

describe("WeChatAccountConfigSchema", () => {
  it("parses valid account config", () => {
    const result = WeChatAccountConfigSchema.parse({
      platform: "official",
      appId: "wx123",
      appSecret: "secret",
      token: "mytoken",
      enabled: true,
    });

    expect(result.platform).toBe("official");
    expect(result.enabled).toBe(true);
  });

  it("rejects unknown keys", () => {
    const result = WeChatAccountConfigSchema.safeParse({
      unknownKey: "value",
    });
    expect(result.success).toBe(false);
  });
});
