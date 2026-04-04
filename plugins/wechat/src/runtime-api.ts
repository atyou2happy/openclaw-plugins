export type { PluginRuntime } from "openclaw/plugin-sdk/runtime-store";

export type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";

export {
  DEFAULT_ACCOUNT_ID,
  createChatChannelPlugin,
  defineChannelPluginEntry,
  defineSetupPluginEntry,
  buildChannelConfigSchema,
} from "openclaw/plugin-sdk/core";

export {
  createAccountListHelpers,
  resolveMergedAccountConfig,
  normalizeOptionalAccountId,
} from "openclaw/plugin-sdk/account-resolution";

export { buildDmGroupAccountAllowlistAdapter } from "openclaw/plugin-sdk/allowlist-config-edit";

export const PAIRING_APPROVED_MESSAGE = "✓ Paired successfully.";

export function chunkTextForOutbound(text: string, limit: number = 2000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let splitAt = Math.min(limit, remaining.length);
    if (splitAt < remaining.length) {
      const lastNewline = remaining.lastIndexOf("\n", splitAt);
      if (lastNewline > splitAt * 0.5) splitAt = lastNewline + 1;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}
