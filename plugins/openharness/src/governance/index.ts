import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const configFile = path.join(process.env.HOME || "~", ".openharness", "governance.json");

interface GovernanceConfig {
  mode: "default" | "auto" | "plan";
  pathRules: { pattern: string; allow: boolean }[];
  deniedCommands: string[];
  allowedTools: string[];
  deniedTools: string[];
}

const defaultConfig: GovernanceConfig = {
  mode: "default",
  pathRules: [{ pattern: "/etc/*", allow: false }, { pattern: "/root/*", allow: false }],
  deniedCommands: ["rm -rf /", "DROP TABLE *", ":(){:|:&};:", "mkfs", "dd if=/dev/zero"],
  allowedTools: [],
  deniedTools: [],
};

async function loadConfig(): Promise<GovernanceConfig> {
  try {
    const content = await fs.readFile(configFile, "utf-8");
    return { ...defaultConfig, ...JSON.parse(content) };
  } catch {
    return defaultConfig;
  }
}

async function saveConfig(config: GovernanceConfig) {
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(config, null, 2));
}

function matchesPattern(pattern: string, value: string): boolean {
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  return regex.test(value);
}

function isDangerousCommand(cmd: string, deniedCommands: string[]): boolean {
  return deniedCommands.some((pattern) => {
    if (pattern.includes("*")) {
      return matchesPattern(pattern, cmd);
    }
    return cmd.includes(pattern);
  });
}

function isPathRestricted(filePath: string, pathRules: { pattern: string; allow: boolean }[]): { blocked: boolean; reason: string } {
  for (const rule of pathRules) {
    if (matchesPattern(rule.pattern, filePath)) {
      if (!rule.allow) {
        return { blocked: true, reason: `Path '${filePath}' matches denied pattern '${rule.pattern}'` };
      }
    }
  }
  return { blocked: false, reason: "" };
}

export function registerGovernance(api: any) {

    api.registerTool({
      name: "oh_permissions",
      label: "Manage Permissions",

      parameters: Type.Object({
        action: Type.String({ description: "Action: view, set-mode, add-path-rule, add-denied-command, add-allowed-tool, add-denied-tool", enum: ["view", "set-mode", "add-path-rule", "add-denied-command", "add-allowed-tool", "add-denied-tool"] }),
        value: Type.Optional(Type.String({ description: "Value for the action (e.g., 'auto' for set-mode, '/tmp/*' for path rule)" })),
        allow: Type.Optional(Type.Boolean({ description: "Whether the path rule should allow or deny" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const config = await loadConfig();
        const { action, value, allow = true } = params;
        switch (action) {
          case "view":
            return { content: [{ type: "text" as const, text: `Governance Config:\nMode: ${config.mode}\nPath Rules: ${JSON.stringify(config.pathRules, null, 2)}\nDenied Commands: ${config.deniedCommands.join(", ")}\nAllowed Tools: ${config.allowedTools.join(", ") || "(all)"}\nDenied Tools: ${config.deniedTools.join(", ") || "(none)"}` }], details: { success: true } };
          case "set-mode":
            if (!["default", "auto", "plan"].includes(value)) {
              return { content: [{ type: "text" as const, text: "Invalid mode. Use: default, auto, or plan" }], details: { success: true } };
            }
            config.mode = value as any;
            await saveConfig(config);
            return { content: [{ type: "text" as const, text: `Permission mode set to: ${value}` }], details: { success: true } };
          case "add-path-rule":
            if (!value) return { content: [{ type: "text" as const, text: "Provide a path pattern (e.g., '/etc/*')" }], details: { success: true } };
            config.pathRules.push({ pattern: value, allow });
            await saveConfig(config);
            return { content: [{ type: "text" as const, text: `Path rule added: ${value} -> ${allow ? "allow" : "deny"}` }], details: { success: true } };
          case "add-denied-command":
            if (!value) return { content: [{ type: "text" as const, text: "Provide a command pattern to deny" }], details: { success: true } };
            config.deniedCommands.push(value);
            await saveConfig(config);
            return { content: [{ type: "text" as const, text: `Denied command added: ${value}` }], details: { success: true } };
          case "add-allowed-tool":
            if (!value) return { content: [{ type: "text" as const, text: "Provide a tool name to allow" }], details: { success: true } };
            config.allowedTools.push(value);
            await saveConfig(config);
            return { content: [{ type: "text" as const, text: `Allowed tool added: ${value}` }], details: { success: true } };
          case "add-denied-tool":
            if (!value) return { content: [{ type: "text" as const, text: "Provide a tool name to deny" }], details: { success: true } };
            config.deniedTools.push(value);
            await saveConfig(config);
            return { content: [{ type: "text" as const, text: `Denied tool added: ${value}` }], details: { success: true } };
          default:
            return { content: [{ type: "text" as const, text: "Unknown action. Use: view, set-mode, add-path-rule, add-denied-command, add-allowed-tool, add-denied-tool" }], details: { success: true } };
        }
      },
    });

    api.on("before_tool_call", async (event: any, ctx: any) => {
      const config = await loadConfig();
      const toolName = event.toolName || "";
      const toolArgs = event.toolArgs || {};

      if (config.mode === "plan") {
        const writeTools = ["oh_file_write", "oh_file_edit", "oh_bash"];
        if (writeTools.includes(toolName)) {
          return { block: true, blockReason: `Plan mode: write operations are blocked. Tool '${toolName}' is not allowed in plan mode.` };
        }
      }

      if (config.mode === "auto") {
        return undefined;
      }

      if (config.deniedTools.includes(toolName)) {
        return { block: true, blockReason: `Tool '${toolName}' is explicitly denied` };
      }

      if (config.allowedTools.length > 0 && !config.allowedTools.includes(toolName)) {
        return { requireApproval: { title: "Tool Approval", description: `Allow tool '${toolName}'? (not in allowlist)` } };
      }

      if (toolName === "oh_bash" && toolArgs.command) {
        if (isDangerousCommand(toolArgs.command, config.deniedCommands)) {
          return { block: true, blockReason: `Command matches a denied pattern` };
        }
      }

      if (toolName === "oh_file_write" && toolArgs.file_path) {
        const check = isPathRestricted(toolArgs.file_path, config.pathRules);
        if (check.blocked) {
          return { block: true, blockReason: check.reason };
        }
      }

      if (toolName === "oh_file_edit" && toolArgs.file_path) {
        const check = isPathRestricted(toolArgs.file_path, config.pathRules);
        if (check.blocked) {
          return { block: true, blockReason: check.reason };
        }
      }

      return undefined;
    });

    api.on("after_tool_call", async (event: any, ctx: any) => {
      const toolName = event.toolName || "";
      const result = event.result || "";
      const isError = event.isError || false;
      if (isError) {
        console.error(`[governance] Tool '${toolName}' failed: ${result}`);
      }
    });
  }
