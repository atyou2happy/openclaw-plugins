import { createChannelPluginBase } from "openclaw/plugin-sdk/core";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { DevWorkflowAccount } from "../types.js";

const CHANNEL_ID = "dev-workflow";

export const devWorkflowChannel = createChannelPluginBase<DevWorkflowAccount>({
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: "Dev Workflow",
    selectionLabel: "Dev Workflow (AI-Driven Development)",
    docsPath: "/channels/dev-workflow",
    docsLabel: "dev-workflow",
    blurb: "Spec-driven AI development workflow with multi-agent orchestration.",
    order: 50,
    aliases: ["dwf", "devflow"],
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct"],
    nativeCommands: true,
    media: true,
  },
  setup: {
    applyAccountConfig: (params: { cfg: OpenClawConfig; accountId: string; input: any }) => {
      return params.cfg;
    },
  },
  config: {
    listAccountIds: (cfg: OpenClawConfig) => {
      const accounts = (cfg as any).channels?.[CHANNEL_ID] ?? {};
      return Object.keys(accounts).filter((k) => k !== "allowFrom");
    },
    resolveAccount: (_cfg: OpenClawConfig, accountId?: string | null): DevWorkflowAccount => ({
      accountId: accountId ?? "default",
      enabled: true,
    }),
    isEnabled: (account: DevWorkflowAccount) => account.enabled !== false,
    isConfigured: () => true,
  },
});
