import { createChatChannelPlugin, DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/core";
import { resolveWeChatAccount, listConfiguredWeChatAccountIds } from "./accounts.js";
import { parseXmlMessage, parseWeChatMessage, buildPassiveSuccessReply } from "./bot.js";
import { WeChatConfigSchema } from "./config-schema.js";
import { wechatOutbound } from "./outbound.js";
import { PAIRING_APPROVED_MESSAGE, chunkTextForOutbound } from "./runtime-api.js";
import { sendMessageWeChat } from "./send.js";
import type { ResolvedWeChatAccount } from "./types.js";
import type { WeChatProbeResult } from "./types.js";

function describeWeChatMessageTool(_params: any): any {
  return {
    actions: ["send"] as const,
    capabilities: [] as string[],
    schema: null,
  };
}

async function probeWeChatAccount(params: {
  account: ResolvedWeChatAccount;
}): Promise<WeChatProbeResult> {
  try {
    if (params.account.platform === "official" && params.account.official) {
      const { getOrCreateOfficialClient } = await import("./client.js");
      const client = getOrCreateOfficialClient(params.account.accountId, params.account.official);
      const token = await client.getAccessToken();
      return {
        ok: true,
        platform: "official",
        accountId: params.account.accountId,
        accessTokenValid: !!token,
      };
    }
    if (params.account.platform === "wecom" && params.account.wecom) {
      const { getOrCreateWecomClient } = await import("./client.js");
      const client = getOrCreateWecomClient(params.account.accountId, params.account.wecom);
      const token = await client.getAccessToken();
      return {
        ok: true,
        platform: "wecom",
        accountId: params.account.accountId,
        accessTokenValid: !!token,
      };
    }
    return {
      ok: false,
      platform: params.account.platform,
      accountId: params.account.accountId,
      accessTokenValid: false,
      error: "Account not configured",
    };
  } catch (err) {
    return {
      ok: false,
      platform: params.account.platform,
      accountId: params.account.accountId,
      accessTokenValid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const wechatPlugin = createChatChannelPlugin<ResolvedWeChatAccount, WeChatProbeResult>({
  base: {
    id: "wechat",
    meta: {
      id: "wechat",
      label: "WeChat",
      selectionLabel: "WeChat / 微信",
      docsPath: "/channels/wechat",
      blurb: "WeChat Official Account and WeCom channel support",
    },
    capabilities: {
      chatTypes: ["direct"],
      polls: false,
      threads: false,
      media: true,
      reactions: false,
      edit: false,
      reply: true,
    },
    reload: { configPrefixes: ["channels.wechat"] },
    config: {
      resolveAccount: (cfg: any, accountId?: string | null) =>
        resolveWeChatAccount(cfg, accountId) as any,
      listAccountIds: (cfg: any) => listConfiguredWeChatAccountIds(cfg),
      defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    } as any,
    configSchema: {
      safeParse: (value: unknown) => {
        const result = WeChatConfigSchema.safeParse(value);
        if (result.success) {
          return { success: true as const, data: result.data };
        }
        return {
          success: false as const,
          error: {
            issues: result.error.issues.map((i) => ({
              path: i.path as Array<string | number>,
              message: i.message,
            })),
          },
        };
      },
    } as any,
    gateway: {
      startAccount: async (ctx: any) => {
        const account = resolveWeChatAccount(ctx.cfg as Record<string, unknown>, ctx.accountId);

        if (!account.configured) {
          throw new Error(`WeChat account "${ctx.accountId}" is not fully configured`);
        }

        const webhookPath = account.config.webhookPath ?? "/wechat/callback";
        const webhookPort = account.config.webhookPort;

        if (webhookPort) {
          const { createServer } = await import("http");
          const server = createServer(async (req: any, res: any) => {
            const url = new URL(req.url ?? "/", `http://localhost:${webhookPort}`);

            if (!url.pathname.startsWith(webhookPath)) {
              res.writeHead(404);
              res.end("Not Found");
              return;
            }

            if (req.method === "GET") {
              const signature = url.searchParams.get("signature") ?? "";
              const timestamp = url.searchParams.get("timestamp") ?? "";
              const nonce = url.searchParams.get("nonce") ?? "";
              const echostr = url.searchParams.get("echostr") ?? "";

              let isValid = false;
              try {
                if (account.platform === "official" && account.official) {
                  const { getOrCreateOfficialClient } = await import("./client.js");
                  const client = getOrCreateOfficialClient(account.accountId, account.official);
                  isValid = client.verifySignature(signature, timestamp, nonce);
                } else if (account.wecom) {
                  const { getOrCreateWecomClient } = await import("./client.js");
                  const client = getOrCreateWecomClient(account.accountId, account.wecom);
                  isValid = client.verifySignature(signature, timestamp, nonce);
                }
              } catch {
                isValid = false;
              }

              res.writeHead(isValid ? 200 : 403, { "Content-Type": "text/plain" });
              res.end(isValid ? echostr : "Forbidden");
              return;
            }

            if (req.method === "POST") {
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
              }
              const body = Buffer.concat(chunks).toString("utf8");

              const msg = parseXmlMessage(body);
              if (!msg) {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end(buildPassiveSuccessReply());
                return;
              }

              const parsed = parseWeChatMessage(msg);

              if (parsed.msgType === "event" || !parsed.content.trim()) {
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end(buildPassiveSuccessReply());
                return;
              }

              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end(buildPassiveSuccessReply());

              try {
                if (ctx.channelRuntime?.reply?.dispatchReplyFromConfig) {
                  await ctx.channelRuntime.reply.dispatchReplyFromConfig({
                    cfg: ctx.cfg,
                    dispatcher: ctx.dispatcher,
                    replyOptions: ctx.replyOptions,
                  });
                }
              } catch (err) {
                ctx.log?.error?.("WeChat dispatch error", err);
              }
              return;
            }

            res.writeHead(405);
            res.end("Method Not Allowed");
          });

          server.listen(webhookPort, () => {
            ctx.log?.info?.(`WeChat webhook listening on :${webhookPort}${webhookPath}`);
          });

          return {
            stop: async () => {
              server.close();
            },
          };
        }

        return { stop: async () => {} };
      },
    } as any,
    actions: {
      describeMessageTool: describeWeChatMessageTool,
      handleAction: async (ctx: any) => {
        const { action, cfg, target, text, accountId } = ctx;
        if (action === "send" && text) {
          const account = resolveWeChatAccount(cfg as Record<string, unknown>, accountId);
          const result = await sendMessageWeChat({ account, to: target, text });
          return {
            content: [{ type: "text" as const, text: `Message sent: ${result.messageId}` }],
            details: result,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Unsupported action: ${action}` }],
          details: { success: false, error: `Unsupported action: ${action}` },
        };
      },
    } as any,
    agentPrompt: {
      messageToolHints: () => ["Use wechat_send_message to send text messages to WeChat users"],
    } as any,
    mentions: {
      stripPatterns: () => [],
    },
    messaging: {
      normalizeTarget: (raw: string) => raw.trim() || undefined,
    } as any,
    status: {
      probeAccount: async (params: { account: ResolvedWeChatAccount }) =>
        probeWeChatAccount(params),
    } as any,
  },
  pairing: {
    text: {
      idLabel: "wechatUserId",
      message: PAIRING_APPROVED_MESSAGE,
      normalizeAllowEntry: (entry: string) => entry.trim(),
      notify: async () => {},
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: chunkTextForOutbound,
    textChunkLimit: 2000,
    sendText: async (ctx: any) => {
      const { cfg, to, text, accountId } = ctx;
      const account = resolveWeChatAccount(cfg as Record<string, unknown>, accountId);
      const result = await sendMessageWeChat({ account, to, text });
      return { messageId: result.messageId, chatId: result.chatId };
    },
    sendMedia: async (ctx: any) => {
      const { cfg, to, mediaUrl, accountId } = ctx;
      const account = resolveWeChatAccount(cfg as Record<string, unknown>, accountId);

      if (account.platform === "official" && account.official) {
        const { getOrCreateOfficialClient } = await import("./client.js");
        const client = getOrCreateOfficialClient(account.accountId, account.official);
        const media = await client.uploadMedia(mediaUrl);
        const send = await client.sendImageMessage(to, media.media_id);
        return { messageId: send.msgid ?? `wx_${Date.now()}`, chatId: to };
      }
      if (account.platform === "wecom" && account.wecom) {
        const { getOrCreateWecomClient } = await import("./client.js");
        const client = getOrCreateWecomClient(account.accountId, account.wecom);
        const media = await client.uploadMedia(mediaUrl);
        const send = await client.sendImageMessage(to, media.media_id);
        return { messageId: send.msgid ?? `wc_${Date.now()}`, chatId: to };
      }
      throw new Error(`Account ${account.accountId} not configured for media`);
    },
  } as any,
});
