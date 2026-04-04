import {
  normalizeOptionalAccountId,
  resolveMergedAccountConfig,
  createAccountListHelpers,
} from "openclaw/plugin-sdk/account-resolution";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/core";
import type {
  WeChatAccountConfig,
  WeChatPlatform,
  ResolvedWeChatAccount,
  WeChatConfig,
} from "./types.js";

const { listAccountIds: listWeChatAccountIds } = createAccountListHelpers("wechat", {
  allowUnlistedDefaultAccount: true,
});

export { listWeChatAccountIds };

function resolvePlatform(config: WeChatAccountConfig): WeChatPlatform {
  if (config.platform) return config.platform;
  if (config.corpid) return "wecom";
  return "official";
}

export function resolveWeChatAccount(cfg: any, accountId?: string | null): ResolvedWeChatAccount {
  const raw = (cfg?.channels?.wechat ?? {}) as WeChatConfig;
  const resolvedAccountId = normalizeOptionalAccountId(accountId) ?? DEFAULT_ACCOUNT_ID;

  let accountConfig: WeChatAccountConfig;

  if (resolvedAccountId === DEFAULT_ACCOUNT_ID) {
    accountConfig = raw;
  } else {
    const accountEntry = raw.accounts?.[resolvedAccountId];
    if (!accountEntry) {
      throw new Error(`WeChat account "${resolvedAccountId}" not found in config`);
    }
    accountConfig = resolveMergedAccountConfig({
      channelConfig: raw as Record<string, unknown>,
      accounts: raw.accounts as Record<string, Partial<Record<string, unknown>>> | undefined,
      accountId: resolvedAccountId,
    }) as WeChatAccountConfig;
  }

  const platform = resolvePlatform(accountConfig);

  const official =
    platform === "official" && accountConfig.appId && accountConfig.appSecret && accountConfig.token
      ? {
          appId: accountConfig.appId,
          appSecret: accountConfig.appSecret,
          token: accountConfig.token!,
          encodingAESKey: accountConfig.encodingAESKey,
        }
      : null;

  const wecom =
    platform === "wecom" && accountConfig.corpid && accountConfig.corpsecret && accountConfig.token
      ? {
          corpid: accountConfig.corpid,
          corpsecret: accountConfig.corpsecret,
          agentid: accountConfig.agentid ?? 0,
          token: accountConfig.token!,
          encodingAESKey: accountConfig.encodingAESKey,
        }
      : null;

  const configured = platform === "official" ? !!official : !!wecom;

  return {
    accountId: resolvedAccountId,
    selectionSource: resolvedAccountId === DEFAULT_ACCOUNT_ID ? "default" : "named",
    enabled: accountConfig.enabled !== false,
    configured,
    platform,
    official,
    wecom,
    config: accountConfig,
  };
}

export function listConfiguredWeChatAccountIds(cfg: Record<string, unknown>): string[] {
  return listWeChatAccountIds(cfg);
}
