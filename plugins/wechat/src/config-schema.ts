import { z } from "openclaw/plugin-sdk/zod";
export { z };

const DmPolicySchema = z.enum(["open", "pairing", "allowlist", "disabled"]);
const GroupPolicySchema = z.enum(["open", "allowlist", "disabled"]);
const WeChatPlatformSchema = z.enum(["official", "wecom"]);
const ReplyToModeSchema = z.enum(["thread", "flat"]);

const WeChatSharedConfigShape = {
  enabled: z.boolean().optional(),
  platform: WeChatPlatformSchema.optional(),
  dmPolicy: DmPolicySchema.optional(),
  groupPolicy: GroupPolicySchema.optional(),
  allowFrom: z.array(z.string()).optional(),
  groupAllowFrom: z.array(z.string()).optional(),
  requireMention: z.boolean().optional(),
  replyToMode: ReplyToModeSchema.optional(),
  mediaMaxMb: z.number().positive().optional(),
  maxRetries: z.number().int().positive().optional(),
  webhookPort: z.number().int().positive().optional(),
  webhookPath: z.string().optional(),
};

const WeChatCredentialsShape = {
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  corpid: z.string().optional(),
  corpsecret: z.string().optional(),
  agentid: z.number().int().positive().optional(),
  token: z.string().optional(),
  encodingAESKey: z.string().optional(),
};

export const WeChatAccountConfigSchema = z
  .object({
    ...WeChatSharedConfigShape,
    ...WeChatCredentialsShape,
  })
  .strict();

export const WeChatConfigSchema = z
  .object({
    ...WeChatSharedConfigShape,
    ...WeChatCredentialsShape,
    defaultAccount: z.string().optional(),
    accounts: z.record(z.string(), WeChatAccountConfigSchema.optional()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.platform === "official") {
      if (!data.appId && !data.accounts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "appId is required for official account platform",
          path: ["appId"],
        });
      }
      if (!data.appSecret && !data.accounts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "appSecret is required for official account platform",
          path: ["appSecret"],
        });
      }
    }
    if (data.platform === "wecom") {
      if (!data.corpid && !data.accounts) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "corpid is required for WeCom platform",
          path: ["corpid"],
        });
      }
    }
  });

export type WeChatConfigInput = z.infer<typeof WeChatConfigSchema>;
export type WeChatAccountConfigInput = z.infer<typeof WeChatAccountConfigSchema>;
