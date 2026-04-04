export type WeChatPlatform = "official" | "wecom";

export interface WeChatOfficialConfig {
  appId: string;
  appSecret: string;
  token: string;
  encodingAESKey?: string;
}

export interface WeChatWecomConfig {
  corpid: string;
  corpsecret: string;
  agentid: number;
  token: string;
  encodingAESKey?: string;
}

export interface WeChatSharedConfig {
  enabled?: boolean;
  platform?: WeChatPlatform;
  dmPolicy?: "open" | "pairing" | "allowlist" | "disabled";
  groupPolicy?: "open" | "allowlist" | "disabled";
  allowFrom?: string[];
  groupAllowFrom?: string[];
  requireMention?: boolean;
  replyToMode?: "thread" | "flat";
  mediaMaxMb?: number;
  maxRetries?: number;
  webhookPort?: number;
  webhookPath?: string;
}

export type WeChatAccountConfig = WeChatSharedConfig &
  Partial<WeChatOfficialConfig> &
  Partial<WeChatWecomConfig> & { enabled?: boolean };

export interface WeChatConfig extends WeChatSharedConfig {
  enabled?: boolean;
  defaultAccount?: string;
  accounts?: Record<string, WeChatAccountConfig>;
}

export type ResolvedWeChatAccount = {
  accountId: string;
  selectionSource: string;
  enabled: boolean;
  configured: boolean;
  platform: WeChatPlatform;
  official: WeChatOfficialConfig | null;
  wecom: WeChatWecomConfig | null;
  config: WeChatAccountConfig;
};

export type WeChatMessageContext = {
  messageId: string;
  chatId: string;
  senderId: string;
  chatType: "direct" | "group";
  content: string;
  msgType: string;
  createTime: number;
  raw: unknown;
};

export type WeChatSendResult = {
  messageId: string;
  chatId: string;
};

export type WeChatProbeResult = {
  ok: boolean;
  platform: WeChatPlatform;
  accountId: string;
  accessTokenValid: boolean;
  error?: string;
};

export type WeChatAccessToken = {
  token: string;
  expiresAt: number;
};

export type WeChatInboundMessage = {
  xml: {
    ToUserName: string | string[];
    FromUserName: string | string[];
    CreateTime: string | string[];
    MsgType: string | string[];
    Content?: string | string[];
    MsgId?: string | string[];
    AgentID?: string | string[];
    Encrypt?: string | string[];
    PicUrl?: string | string[];
    MediaId?: string | string[];
    Format?: string | string[];
    Recognition?: string | string[];
    Event?: string | string[];
    EventKey?: string | string[];
  };
};
