import crypto from "crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WeChatOfficialClient, WeChatWecomClient, clearClientCache } from "../src/client.js";

describe("WeChatOfficialClient", () => {
  const config = {
    appId: "wx_test_appid",
    appSecret: "test_app_secret",
    token: "test_token",
    encodingAESKey: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH",
  };

  it("stores config properties", () => {
    const client = new WeChatOfficialClient(config);
    expect(client.platform).toBe("official");
    expect(client.appId).toBe("wx_test_appid");
    expect(client.appSecret).toBe("test_app_secret");
    expect(client.token).toBe("test_token");
    expect(client.encodingAESKey).toBe("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH");
  });

  it("sets encodingAESKey to null when not provided", () => {
    const client = new WeChatOfficialClient({
      appId: "wx_test",
      appSecret: "secret",
      token: "tok",
    });
    expect(client.encodingAESKey).toBeNull();
  });

  describe("verifySignature", () => {
    it("verifies a correct signature", () => {
      const client = new WeChatOfficialClient(config);
      const sorted = [config.token, "1234567890", "testnonce"].sort().join("");
      const expected = crypto.createHash("sha1").update(sorted).digest("hex");

      expect(client.verifySignature(expected, "1234567890", "testnonce")).toBe(true);
    });

    it("rejects an incorrect signature", () => {
      const client = new WeChatOfficialClient(config);
      expect(client.verifySignature("badsignature", "1234567890", "testnonce")).toBe(false);
    });
  });

  describe("getAccessToken", () => {
    it("fetches and caches access token", async () => {
      const client = new WeChatOfficialClient(config);
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ access_token: "test_token_123", expires_in: 7200 }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const token1 = await client.getAccessToken();
      expect(token1).toBe("test_token_123");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const token2 = await client.getAccessToken();
      expect(token2).toBe("test_token_123");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });

    it("throws on API error", async () => {
      const client = new WeChatOfficialClient(config);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ errcode: 40013, errmsg: "invalid appid" }),
        }),
      );

      await expect(client.getAccessToken()).rejects.toThrow(/access token error/i);
      vi.restoreAllMocks();
    });
  });

  describe("sendCustomerServiceMessage", () => {
    it("sends text message via customer service API", async () => {
      const client = new WeChatOfficialClient(config);
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({
            json: () => Promise.resolve({ access_token: "tok123", expires_in: 7200 }),
          })
          .mockResolvedValueOnce({
            json: () => Promise.resolve({ msgid: "msg_001" }),
          }),
      );

      const result = await client.sendCustomerServiceMessage("user_openid", "Hello");
      expect(result.msgid).toBe("msg_001");
      vi.restoreAllMocks();
    });
  });

  describe("decryptMessage", () => {
    it("throws when encodingAESKey is not set", () => {
      const client = new WeChatOfficialClient({
        appId: "wx_test",
        appSecret: "secret",
        token: "tok",
      });
      expect(() => client.decryptMessage("encrypted", "sig", "ts", "nonce")).toThrow(
        /encodingAESKey is required/,
      );
    });
  });
});

describe("WeChatWecomClient", () => {
  const config = {
    corpid: "test_corp_id",
    corpsecret: "test_corp_secret",
    agentid: 1000002,
    token: "wecom_token",
    encodingAESKey: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH",
  };

  it("stores config properties", () => {
    const client = new WeChatWecomClient(config);
    expect(client.platform).toBe("wecom");
    expect(client.corpid).toBe("test_corp_id");
    expect(client.corpsecret).toBe("test_corp_secret");
    expect(client.agentid).toBe(1000002);
    expect(client.token).toBe("wecom_token");
  });

  describe("getAccessToken", () => {
    it("fetches wecom access token", async () => {
      const client = new WeChatWecomClient(config);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ errcode: 0, access_token: "wecom_tok", expires_in: 7200 }),
        }),
      );

      const token = await client.getAccessToken();
      expect(token).toBe("wecom_tok");
      vi.restoreAllMocks();
    });

    it("throws on API error", async () => {
      const client = new WeChatWecomClient(config);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ errcode: 40013, errmsg: "invalid corpid" }),
        }),
      );

      await expect(client.getAccessToken()).rejects.toThrow(/WeCom access token error/);
      vi.restoreAllMocks();
    });
  });

  describe("sendMessage", () => {
    it("sends text message", async () => {
      const client = new WeChatWecomClient(config);
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce({
            json: () => Promise.resolve({ errcode: 0, access_token: "tok", expires_in: 7200 }),
          })
          .mockResolvedValueOnce({
            json: () => Promise.resolve({ msgid: "wc_msg_001" }),
          }),
      );

      const result = await client.sendMessage("user123", "Hello WeCom");
      expect(result.msgid).toBe("wc_msg_001");
      vi.restoreAllMocks();
    });
  });

  describe("verifySignature", () => {
    it("verifies a correct signature", () => {
      const client = new WeChatWecomClient(config);
      const sorted = [config.token, "ts123", "nonce456"].sort().join("");
      const expected = crypto.createHash("sha1").update(sorted).digest("hex");

      expect(client.verifySignature(expected, "ts123", "nonce456")).toBe(true);
    });
  });
});

describe("clearClientCache", () => {
  it("does not throw", () => {
    expect(() => clearClientCache()).not.toThrow();
  });
});
