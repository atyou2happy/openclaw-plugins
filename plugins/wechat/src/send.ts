import { getOrCreateOfficialClient, getOrCreateWecomClient } from "./client.js";
import type { ResolvedWeChatAccount, WeChatSendResult } from "./types.js";

export async function sendMessageWeChat(params: {
  account: ResolvedWeChatAccount;
  to: string;
  text: string;
}): Promise<WeChatSendResult> {
  const { account, to, text } = params;

  if (account.platform === "official" && account.official) {
    const client = getOrCreateOfficialClient(account.accountId, account.official);
    const result = await client.sendCustomerServiceMessage(to, text);
    if (result.errcode && result.errcode !== 0) {
      throw new Error(`WeChat send error: ${result.errmsg} (code: ${result.errcode})`);
    }
    return {
      messageId: result.msgid ?? `wx_${Date.now()}`,
      chatId: to,
    };
  }

  if (account.platform === "wecom" && account.wecom) {
    const client = getOrCreateWecomClient(account.accountId, account.wecom);
    const result = await client.sendMessage(to, text);
    if (result.errcode && result.errcode !== 0) {
      throw new Error(`WeCom send error: ${result.errmsg} (code: ${result.errcode})`);
    }
    return {
      messageId: result.msgid ?? `wc_${Date.now()}`,
      chatId: to,
    };
  }

  throw new Error(`WeChat account ${account.accountId} is not properly configured`);
}

export async function sendTypingWeChat(_params: {
  account: ResolvedWeChatAccount;
  to: string;
}): Promise<void> {
  // WeChat doesn't have a typing indicator API
  // This is a no-op placeholder
}
