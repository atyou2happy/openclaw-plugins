export function registerHooks(api: any) {
  // 保留原有的工具调用日志 hook
  api.registerHook("before_tool_call", async (event: any) => {
    api.logger?.info?.(`[cross-platform-sync] Tool ${event?.toolName ?? "unknown"} called`);
  }, { name: "cross-platform-sync-before-tool-call" });

  api.registerHook("after_tool_call", async (event: any) => {
    api.logger?.info?.(`[cross-platform-sync] Tool ${event?.toolName ?? "unknown"} completed`);
  }, { name: "cross-platform-sync-after-tool-call" });

  // ===== 自动消息同步 Hook =====
  registerAutoSyncHooks(api);
}

// ========== 同步配置 ==========

const SYNC_RULES: Record<string, string[]> = {
  qqbot: ["feishu"],
  feishu: ["qqbot"],
  weixin: ["feishu", "qqbot"],
};

const PLATFORM_LABELS: Record<string, string> = {
  qqbot: "QQ",
  feishu: "飞书",
  weixin: "微信",
  web: "Web",
};

const SYNC_PREFIXES = ["↗ 来自", "Sync from", "**【同步】**"];

// ========== 工具函数 ==========

function isAlreadySynced(content: string): boolean {
  return SYNC_PREFIXES.some(p => content.includes(p));
}

function formatSyncMessage(content: string, senderName: string, sourcePlatform: string): string {
  const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const label = PLATFORM_LABELS[sourcePlatform] || sourcePlatform;
  const truncated = content.length > 4000 ? content.slice(0, 4000) + "..." : content;
  return `**【${senderName}】** ${ts}\n\n${truncated}\n\n_↗ 来自${label}_`;
}

function getTargets(sourcePlatform: string): string[] {
  return SYNC_RULES[sourcePlatform] || [];
}

async function forwardMessage(api: any, target: string, message: string, sourceSessionKey: string): Promise<boolean> {
  try {
    if (typeof api.sendMessage === 'function') {
      await api.sendMessage({ channel: target, message, sessionKey: sourceSessionKey });
      return true;
    }
    if (typeof api.send === 'function') {
      await api.send({ channel: target, message, sessionKey: sourceSessionKey });
      return true;
    }
    if (typeof api.emit === 'function') {
      api.emit('send_message', { channel: target, message, sessionKey: sourceSessionKey });
      return true;
    }
    api.logger?.warn?.(`[cross-platform-sync] No send API available for ${target}`);
    return false;
  } catch (err: any) {
    api.logger?.error?.(`[cross-platform-sync] Forward to ${target} failed: ${err.message}`);
    return false;
  }
}

// ========== 自动同步 Hook 注册 ==========

function registerAutoSyncHooks(api: any) {
  // 入站消息 hook（用户消息转发）
  const inboundEvents = [
    "on_inbound_message",
    "on_message",
    "message:inbound",
    "before_agent",
    "inbound",
  ];

  let registered = false;
  for (const eventName of inboundEvents) {
    try {
      api.registerHook(eventName, async (event: any) => {
        try {
          const platform = event.channel || event.provider || event.source || "";
          const content = event.content || event.text || event.body || "";
          const sender = event.sender?.name || event.sender_name || event.sender?.label || "用户";
          const sessionKey = event.sessionKey || event.chat_id || "";

          if (!content || !content.trim()) return;
          if (isAlreadySynced(content)) return;

          const targets = getTargets(platform);
          if (targets.length === 0) return;

          const formatted = formatSyncMessage(content, sender, platform);

          api.logger?.info?.(`[cross-platform-sync] Forwarding from ${platform} to ${targets.join(",")}`);

          const results = await Promise.allSettled(
            targets.map(t => forwardMessage(api, t, formatted, sessionKey))
          );

          const ok = results.filter(r => r.status === 'fulfilled' && r.value).length;
          api.logger?.info?.(`[cross-platform-sync] Forwarded ${ok}/${targets.length}`);
        } catch (err: any) {
          api.logger?.error?.(`[cross-platform-sync] Inbound error: ${err.message}`);
        }
      }, { name: "cross-platform-sync-auto-inbound" });
      registered = true;
      api.logger?.info?.(`[cross-platform-sync] Auto-sync inbound hook registered: ${eventName}`);
      break;
    } catch {
      // 事件名不存在，尝试下一个
    }
  }

  if (!registered) {
    api.logger?.warn?.("[cross-platform-sync] No inbound hook event found, auto-sync disabled");
  }

  // 出站消息 hook（AI回复转发）
  const outboundEvents = [
    "on_outbound_message",
    "on_response",
    "message:outbound",
    "after_agent",
    "outbound",
  ];

  for (const eventName of outboundEvents) {
    try {
      api.registerHook(eventName, async (event: any) => {
        try {
          const platform = event.channel || event.provider || event.source || "";
          const content = event.content || event.text || event.body || "";
          const sessionKey = event.sessionKey || event.chat_id || "";

          if (!content || !content.trim()) return;
          if (isAlreadySynced(content)) return;

          const targets = getTargets(platform);
          if (targets.length === 0) return;

          const formatted = formatSyncMessage(content, "AI助手", platform);

          api.logger?.info?.(`[cross-platform-sync] Forwarding reply from ${platform} to ${targets.join(",")}`);

          const results = await Promise.allSettled(
            targets.map(t => forwardMessage(api, t, formatted, sessionKey))
          );

          const ok = results.filter(r => r.status === 'fulfilled' && r.value).length;
          api.logger?.info?.(`[cross-platform-sync] Forwarded reply ${ok}/${targets.length}`);
        } catch (err: any) {
          api.logger?.error?.(`[cross-platform-sync] Outbound error: ${err.message}`);
        }
      }, { name: "cross-platform-sync-auto-outbound" });
      api.logger?.info?.(`[cross-platform-sync] Auto-sync outbound hook registered: ${eventName}`);
      break;
    } catch {
      // 尝试下一个
    }
  }
}
