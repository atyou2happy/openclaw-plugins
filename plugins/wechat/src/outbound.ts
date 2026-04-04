import { resolveWeChatAccount } from "./accounts.js";
import { sendMessageWeChat } from "./send.js";
import type { ResolvedWeChatAccount, WeChatSendResult } from "./types.js";

const WECHAT_TEXT_CHUNK_LIMIT = 2000;

function chunkForWeChat(text: string, limit: number = WECHAT_TEXT_CHUNK_LIMIT): string[] {
  const chunks: string[] = [];
  if (text.length <= limit) {
    return [text];
  }
  let remaining = text;
  while (remaining.length > 0) {
    let splitAt = Math.min(limit, remaining.length);
    if (splitAt < remaining.length) {
      const lastNewline = remaining.lastIndexOf("\n", splitAt);
      if (lastNewline > splitAt * 0.5) {
        splitAt = lastNewline + 1;
      }
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

export const wechatOutbound = {
  deliveryMode: "direct" as const,
  chunker: chunkForWeChat,

  sendText: async (params: {
    cfg: unknown;
    to: string;
    text: string;
    accountId?: string;
    replyToId?: string;
  }): Promise<{ messageId: string; chatId: string }> => {
    const { cfg, to, text, accountId } = params;
    const account = resolveWeChatAccount(cfg as Record<string, unknown>, accountId);
    const result = await sendMessageWeChat({ account, to, text });
    return { messageId: result.messageId, chatId: result.chatId };
  },

  sendMedia: async (params: {
    cfg: unknown;
    to: string;
    mediaUrl: string;
    accountId?: string;
  }): Promise<{ messageId: string; chatId: string }> => {
    const { cfg, to, mediaUrl, accountId } = params;
    const account = resolveWeChatAccount(cfg as Record<string, unknown>, accountId);

    if (account.platform === "official" && account.official) {
      const { getOrCreateOfficialClient } = await import("./client.js");
      const client = getOrCreateOfficialClient(account.accountId, account.official);
      const mediaResult = await client.uploadMedia(mediaUrl);
      const sendResult = await client.sendImageMessage(to, mediaResult.media_id);
      return {
        messageId: sendResult.msgid ?? `wx_media_${Date.now()}`,
        chatId: to,
      };
    }

    if (account.platform === "wecom" && account.wecom) {
      const { getOrCreateWecomClient } = await import("./client.js");
      const client = getOrCreateWecomClient(account.accountId, account.wecom);
      const mediaResult = await client.uploadMedia(mediaUrl);
      const sendResult = await client.sendImageMessage(to, mediaResult.media_id);
      return {
        messageId: sendResult.msgid ?? `wc_media_${Date.now()}`,
        chatId: to,
      };
    }

    throw new Error(`Cannot send media: account ${account.accountId} not configured`);
  },
};
