import crypto from "crypto";
import type {
  WeChatAccessToken,
  WeChatOfficialConfig,
  WeChatPlatform,
  WeChatWecomConfig,
} from "./types.js";

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

type ClientCache = {
  official: Map<string, { client: WeChatOfficialClient; accessToken: WeChatAccessToken | null }>;
  wecom: Map<string, { client: WeChatWecomClient; accessToken: WeChatAccessToken | null }>;
};

const cache: ClientCache = {
  official: new Map(),
  wecom: new Map(),
};

export function clearClientCache(): void {
  cache.official.clear();
  cache.wecom.clear();
}

export class WeChatOfficialClient {
  readonly platform: WeChatPlatform = "official";
  readonly appId: string;
  readonly appSecret: string;
  readonly token: string;
  readonly encodingAESKey: string | null;
  private accessToken: WeChatAccessToken | null = null;

  constructor(config: WeChatOfficialConfig) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.token = config.token;
    this.encodingAESKey = config.encodingAESKey ?? null;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
      return this.accessToken.token;
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.access_token) {
      throw new Error(`WeChat access token error: ${JSON.stringify(data)}`);
    }
    this.accessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    return this.accessToken.token;
  }

  verifySignature(signature: string, timestamp: string, nonce: string): boolean {
    const parts = [this.token, timestamp, nonce].sort();
    const hash = crypto.createHash("sha1").update(parts.join("")).digest("hex");
    return hash === signature;
  }

  decryptMessage(
    encrypted: string,
    msgSignature: string,
    timestamp: string,
    nonce: string,
  ): string {
    if (!this.encodingAESKey) {
      throw new Error("encodingAESKey is required for message decryption");
    }
    const key = Buffer.from(this.encodingAESKey + "=", "base64");
    const iv = key.subarray(0, 16);

    const signParts = [this.token, timestamp, nonce, encrypted].sort();
    const signHash = crypto.createHash("sha1").update(signParts.join("")).digest("hex");
    if (signHash !== msgSignature) {
      throw new Error("Message signature verification failed");
    }

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]);

    const content = decrypted.subarray(20);
    const xmlLen = content.readUInt32BE(16);
    return content.subarray(20, 20 + xmlLen).toString("utf8");
  }

  async sendCustomerServiceMessage(
    toUser: string,
    content: string,
  ): Promise<{ msgid?: string; errcode?: number; errmsg?: string }> {
    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: toUser,
        msgtype: "text",
        text: { content },
      }),
    });
    return res.json();
  }

  async uploadMedia(
    mediaPath: string,
    type: "image" | "voice" | "video" | "thumb" = "image",
  ): Promise<{ media_id: string }> {
    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=${type}`;
    const fs = await import("fs");
    const buffer = fs.readFileSync(mediaPath);
    const blob = new Blob([buffer]);
    const formData = new FormData();
    formData.append("media", blob, mediaPath.split("/").pop() ?? "media");
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    return res.json();
  }

  async sendImageMessage(
    toUser: string,
    mediaId: string,
  ): Promise<{ msgid?: string; errcode?: number; errmsg?: string }> {
    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: toUser,
        msgtype: "image",
        image: { media_id: mediaId },
      }),
    });
    return res.json();
  }
}

export class WeChatWecomClient {
  readonly platform: WeChatPlatform = "wecom";
  readonly corpid: string;
  readonly corpsecret: string;
  readonly agentid: number;
  readonly token: string;
  readonly encodingAESKey: string | null;
  private accessToken: WeChatAccessToken | null = null;

  constructor(config: WeChatWecomConfig) {
    this.corpid = config.corpid;
    this.corpsecret = config.corpsecret;
    this.agentid = config.agentid;
    this.token = config.token;
    this.encodingAESKey = config.encodingAESKey ?? null;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
      return this.accessToken.token;
    }
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpid}&corpsecret=${this.corpsecret}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.errcode !== 0) {
      throw new Error(`WeCom access token error: ${data.errmsg} (code: ${data.errcode})`);
    }
    this.accessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    return this.accessToken.token;
  }

  verifySignature(signature: string, timestamp: string, nonce: string): boolean {
    const parts = [this.token, timestamp, nonce].sort();
    const hash = crypto.createHash("sha1").update(parts.join("")).digest("hex");
    return hash === signature;
  }

  decryptMessage(
    encrypted: string,
    msgSignature: string,
    timestamp: string,
    nonce: string,
  ): string {
    if (!this.encodingAESKey) {
      throw new Error("encodingAESKey is required for message decryption");
    }
    const key = Buffer.from(this.encodingAESKey + "=", "base64");
    const iv = key.subarray(0, 16);

    const signParts = [this.token, timestamp, nonce, encrypted].sort();
    const signHash = crypto.createHash("sha1").update(signParts.join("")).digest("hex");
    if (signHash !== msgSignature) {
      throw new Error("WeCom message signature verification failed");
    }

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]);

    const content = decrypted.subarray(20);
    const xmlLen = content.readUInt32BE(16);
    return content.subarray(20, 20 + xmlLen).toString("utf8");
  }

  async sendMessage(
    toUser: string,
    content: string,
    msgType: "text" | "markdown" = "text",
  ): Promise<{ msgid?: string; errcode?: number; errmsg?: string }> {
    const accessToken = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
    const body: Record<string, unknown> = {
      touser: toUser,
      msgtype: msgType,
      agentid: this.agentid,
      safe: 0,
    };
    if (msgType === "text") {
      body.text = { content };
    } else {
      body.markdown = { content };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async sendImageMessage(
    toUser: string,
    mediaId: string,
  ): Promise<{ msgid?: string; errcode?: number; errmsg?: string }> {
    const accessToken = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: toUser,
        msgtype: "image",
        agentid: this.agentid,
        image: { media_id: mediaId },
        safe: 0,
      }),
    });
    return res.json();
  }

  async uploadMedia(
    mediaPath: string,
    type: "image" | "voice" | "video" | "file" = "image",
  ): Promise<{ media_id: string }> {
    const accessToken = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${accessToken}&type=${type}`;
    const fs = await import("fs");
    const buffer = fs.readFileSync(mediaPath);
    const blob = new Blob([buffer]);
    const formData = new FormData();
    formData.append("media", blob, mediaPath.split("/").pop() ?? "media");
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    return res.json();
  }
}

export function getOrCreateOfficialClient(
  accountId: string,
  config: WeChatOfficialConfig,
): WeChatOfficialClient {
  let entry = cache.official.get(accountId);
  if (!entry) {
    const client = new WeChatOfficialClient(config);
    entry = { client, accessToken: null };
    cache.official.set(accountId, entry);
  }
  return entry.client;
}

export function getOrCreateWecomClient(
  accountId: string,
  config: WeChatWecomConfig,
): WeChatWecomClient {
  let entry = cache.wecom.get(accountId);
  if (!entry) {
    const client = new WeChatWecomClient(config);
    entry = { client, accessToken: null };
    cache.wecom.set(accountId, entry);
  }
  return entry.client;
}
