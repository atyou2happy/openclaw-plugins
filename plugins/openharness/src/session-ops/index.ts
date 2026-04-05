import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function runCommand(cmd: string, args: string[]): Promise<string> {
  const { stdout } = await execAsync(`${cmd} ${args.join(" ")}`);
  return stdout.trim();
}

async function detectRepo(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git remote get-url origin");
    const match = stdout.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getProjectHash(cwd: string): string {
  return crypto.createHash("md5").update(cwd).digest("hex").slice(0, 8);
}

export function registerSessionOps(api: any) {

    api.registerTool({

      name: "oh_session_context",
      label: "Show Session Context",

      parameters: Type.Object({
        section: Type.Optional(Type.String({ description: "Specific section to show", enum: ["all", "skills", "claude-md", "memory", "environment", "issue", "pr"] })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        let output = `## Session Context\n\n`;

        if (!params.section || params.section === "environment") {
          output += `### Environment\n`;
          output += `- OS: ${process.platform} ${process.arch}\n`;
          output += `- Node: ${process.version}\n`;
          output += `- CWD: ${cwd}\n`;
          output += `- HOME: ${process.env.HOME || "~"}\n`;
          output += `- Shell: ${process.env.SHELL || "unknown"}\n\n`;
        }

        if (!params.section || params.section === "claude-md") {
          output += `### CLAUDE.md Files\n`;
          let dir = cwd;
          const found: string[] = [];
          for (let i = 0; i < 10; i++) {
            for (const f of ["CLAUDE.md", ".claude/CLAUDE.md"]) {
              try {
                const fp = path.join(dir, f);
                await fs.stat(fp);
                found.push(fp);
              } catch { /* not found */ }
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
          }
          output += found.length > 0 ? found.map((f) => `  - ${f}`).join("\n") + "\n\n" : "  (none found)\n\n";
        }

        if (!params.section || params.section === "memory") {
          output += `### Memory\n`;
          const memDir = path.join(process.env.HOME || "~", ".openharness", "data", "memory", `project-${getProjectHash(cwd)}`);
          try {
            const entries = await fs.readdir(memDir);
            const mdFiles = entries.filter((e) => e.endsWith(".md"));
            output += mdFiles.length > 0 ? `  ${mdFiles.length} memory file(s):\n${mdFiles.map((f) => `  - ${f}`).join("\n")}\n\n` : "  (no memory files)\n\n";
          } catch {
            output += "  (no memory directory)\n\n";
          }
        }

        return { content: [{ type: "text" as const, text: output }], details: { success: true } };
      },
    });

    api.registerTool({

      name: "oh_session_rewind",
      label: "Rewind Conversation",

      parameters: Type.Object({
        turns: Type.Number({ description: "Number of turns to rewind (default: 1)" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const turns = Math.min(params.turns || 1, 50);
        const sessionDir = path.join(process.env.HOME || "~", ".openharness", "data", "sessions");
        const hash = getProjectHash(process.cwd());
        const projectDir = path.join(sessionDir, `project-${hash}`);

        try {
          const latestPath = path.join(projectDir, "latest.json");
          const content = await fs.readFile(latestPath, "utf-8");
          const session = JSON.parse(content);
          const messages = session.messages || [];
          const removed = messages.slice(-turns * 2);
          session.messages = messages.slice(0, -turns * 2);
          session.updatedAt = new Date().toISOString();
          session.messageCount = session.messages.length;

          await fs.writeFile(latestPath, JSON.stringify(session, null, 2));

          return {
            content: [{ type: "text" as const, text: `Rewound ${turns} turn(s).\nRemoved ${removed.length} message(s).\nRemaining messages: ${session.messages.length}` }],
            details: { success: true, turnsRewound: turns, messagesRemoved: removed.length, remainingMessages: session.messages.length },
          };
        } catch {
          return { content: [{ type: "text" as const, text: "No session found to rewind. Start a conversation first." }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_session_tag",
      label: "Tag Session",

      parameters: Type.Object({
        action: Type.String({ description: "Tag action", enum: ["add", "remove", "list"] }),
        tags: Type.Optional(Type.Array(Type.String(), { description: "Tags to add or remove" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const sessionDir = path.join(process.env.HOME || "~", ".openharness", "data", "sessions");
        const hash = getProjectHash(process.cwd());
        const projectDir = path.join(sessionDir, `project-${hash}`);

        try {
          const latestPath = path.join(projectDir, "latest.json");
          const content = await fs.readFile(latestPath, "utf-8");
          const session = JSON.parse(content);
          const currentTags = session.tags || [];

          if (params.action === "add" && params.tags) {
            const newTags = [...new Set([...currentTags, ...params.tags])];
            session.tags = newTags;
            await fs.writeFile(latestPath, JSON.stringify(session, null, 2));
            return { content: [{ type: "text" as const, text: `Tags added: ${params.tags.join(", ")}\nAll tags: ${newTags.join(", ")}` }], details: { success: true, tags: newTags } };
          } else if (params.action === "remove" && params.tags) {
            const newTags = currentTags.filter((t: string) => !params.tags.includes(t));
            session.tags = newTags;
            await fs.writeFile(latestPath, JSON.stringify(session, null, 2));
            return { content: [{ type: "text" as const, text: `Tags removed: ${params.tags.join(", ")}\nRemaining tags: ${newTags.join(", ") || "none"}` }], details: { success: true, tags: newTags } };
          } else if (params.action === "list") {
            return { content: [{ type: "text" as const, text: `Session tags: ${currentTags.length > 0 ? currentTags.join(", ") : "(no tags)"}` }], details: { success: true, tags: currentTags } };
          }

          return { content: [{ type: "text" as const, text: "Specify action (add/remove/list) and tags." }], details: { success: false } };
        } catch {
          return { content: [{ type: "text" as const, text: "No session found to tag." }], details: { success: false } };
        }
      },
    });

    api.registerTool({
      name: "oh_session_share",
      label: "Share Session",

      parameters: Type.Object({
        format: Type.Optional(Type.String({ description: "Share format", enum: ["markdown", "json", "html"], default: "markdown" })),
        output_path: Type.Optional(Type.String({ description: "Output file path (default: stdout)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const sessionDir = path.join(process.env.HOME || "~", ".openharness", "data", "sessions");
        const hash = getProjectHash(process.cwd());
        const projectDir = path.join(sessionDir, `project-${hash}`);

        try {
          const latestPath = path.join(projectDir, "latest.json");
          const content = await fs.readFile(latestPath, "utf-8");
          const session = JSON.parse(content);

          let output: string;
          const date = new Date().toISOString().split("T")[0];
          if (params.format === "json") {
            output = JSON.stringify(session, null, 2);
          } else if (params.format === "html") {
            output = `<!DOCTYPE html><html><head><title>Session ${session.id}</title><style>body{font-family:system-ui;max-width:800px;margin:0 auto;padding:20px} .msg{margin:10px 0;padding:10px;border-radius:8px} .user{background:#e3f2fd} .assistant{background:#f5f5f5}</style></head><body><h1>Session Transcript</h1><p>ID: ${session.id} | Date: ${date} | Messages: ${session.messages?.length || 0}</p>${(session.messages || []).map((m: any) => `<div class="msg ${m.role}"><strong>${m.role}</strong><p>${m.content}</p></div>`).join("")}</body></html>`;
          } else {
            output = `# Session Transcript\n\n**ID:** ${session.id}\n**Date:** ${date}\n**Messages:** ${session.messages?.length || 0}\n**Tags:** ${session.tags?.join(", ") || "none"}\n\n---\n\n${(session.messages || []).map((m: any) => `### ${m.role === "user" ? "👤 User" : "🤖 Assistant"}\n\n${m.content}`).join("\n\n---\n\n")}`;
          }

          if (params.output_path) {
            await fs.writeFile(params.output_path, output, "utf-8");
            return { content: [{ type: "text" as const, text: `Session shared to: ${params.output_path}\nFormat: ${params.format}\nSize: ${output.length} bytes` }], details: { success: true, path: params.output_path } };
          }

          return { content: [{ type: "text" as const, text: `Session Transcript (${params.format}):\n\n${output.slice(0, 5000)}${output.length > 5000 ? "\n\n...[truncated, use output_path to save full transcript]" : ""}` }], details: { success: true, size: output.length } };
        } catch {
          return { content: [{ type: "text" as const, text: "No session found to share." }], details: { success: false } };
        }
      },
    });

    api.registerTool({

      name: "oh_project_init",
      label: "Initialize Project",

      parameters: Type.Object({
        model: Type.Optional(Type.String({ description: "Default model (default: claude-sonnet-4-20250514)" })),
        permission_mode: Type.Optional(Type.String({ description: "Permission mode", enum: ["default", "plan", "full_auto"] })),
        memory_enabled: Type.Optional(Type.Boolean({ description: "Enable memory (default: true)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const ohDir = path.join(cwd, ".openharness");
        const created: string[] = [];

        try {
          await fs.mkdir(ohDir, { recursive: true });
          created.push(".openharness/");

          const settingsPath = path.join(ohDir, "settings.json");
          try {
            await fs.stat(settingsPath);
          } catch {
            const settings = {
              api_key: "",
              model: params.model || "claude-sonnet-4-20250514",
              max_tokens: 16384,
              permission: {
                mode: params.permission_mode || "default",
                allowed_tools: [],
                denied_tools: [],
                path_rules: [],
                denied_commands: [],
              },
              memory: {
                enabled: params.memory_enabled !== false,
                max_files: 5,
                max_entrypoint_lines: 200,
              },
              hooks: {},
              enabled_plugins: {},
              mcp_servers: {},
              theme: "default",
              vim_mode: false,
              voice_mode: false,
              fast_mode: false,
              effort: "medium",
              passes: 1,
            };
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
            created.push(".openharness/settings.json");
          }

          const memoryDir = path.join(process.env.HOME || "~", ".openharness", "data", "memory", `project-${getProjectHash(cwd)}`);
          await fs.mkdir(memoryDir, { recursive: true });
          created.push("~/.openharness/data/memory/");

          const memoryPath = path.join(memoryDir, "MEMORY.md");
          try {
            await fs.stat(memoryPath);
          } catch {
            await fs.writeFile(memoryPath, "# Memory Index\n\n> Project-specific memory for cross-session knowledge.\n\n", "utf-8");
            created.push("MEMORY.md");
          }

          return {
            content: [{ type: "text" as const, text: `Project initialized!\n\nCreated:\n${created.map((c) => `  ✓ ${c}`).join("\n")}\n\nModel: ${params.model || "claude-sonnet-4-20250514"}\nPermission Mode: ${params.permission_mode || "default"}\nMemory: ${params.memory_enabled !== false ? "enabled" : "disabled"}` }],
            details: { success: true, created },
          };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Failed to initialize project: ${err.message}` }], details: { success: false } };
        }
      },
    });

    api.registerTool({

      name: "oh_plugin_reload",
      label: "Reload Plugins",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        const pluginsDir = path.join(process.env.HOME || "~", ".openharness", "plugins");
        try {
          const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
          const pluginDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
          return {
            content: [{ type: "text" as const, text: `Plugin reload triggered.\n\nFound ${pluginDirs.length} plugin(s):\n${pluginDirs.map((p) => `  - ${p}`).join("\n")}\n\nPlugins will be reloaded on next session start.` }],
            details: { success: true, count: pluginDirs.length },
          };
        } catch {
          return { content: [{ type: "text" as const, text: "No plugins directory found. Plugins are loaded on session start." }], details: { success: true } };
        }
      },
    });

    api.registerTool({

      name: "oh_config_runtime",
      label: "Runtime Configuration",

      parameters: Type.Object({
        action: Type.String({ description: "Action", enum: ["show", "set", "reset"] }),
        key: Type.Optional(Type.String({ description: "Setting key (e.g., 'model', 'permission.mode', 'fast_mode')" })),
        value: Type.Optional(Type.String({ description: "New value (for set action)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const settingsPath = path.join(cwd, ".openharness", "settings.json");
        const globalSettingsPath = path.join(process.env.HOME || "~", ".openharness", "settings.json");

        let settingsPathToUse = settingsPath;
        try {
          await fs.stat(settingsPath);
        } catch {
          settingsPathToUse = globalSettingsPath;
        }

        try {
          const content = await fs.readFile(settingsPathToUse, "utf-8");
          const settings = JSON.parse(content);

          if (params.action === "show") {
            if (params.key) {
              const keys = params.key.split(".");
              let value: any = settings;
              for (const k of keys) {
                value = value?.[k];
              }
              return { content: [{ type: "text" as const, text: `${params.key} = ${JSON.stringify(value, null, 2)}` }], details: { success: true, value } };
            }
            return { content: [{ type: "text" as const, text: `## Runtime Settings\n\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\`` }], details: { success: true } };
          } else if (params.action === "set") {
            if (!params.key || params.value === undefined) {
              return { content: [{ type: "text" as const, text: "Both 'key' and 'value' required for set action." }], details: { success: false } };
            }
            const keys = params.key.split(".");
            let obj: any = settings;
            for (let i = 0; i < keys.length - 1; i++) {
              if (!obj[keys[i]]) obj[keys[i]] = {};
              obj = obj[keys[i]];
            }
            const lastKey = keys[keys.length - 1];
            const parsed = params.value === "true" ? true : params.value === "false" ? false : isNaN(Number(params.value)) ? params.value : Number(params.value);
            obj[lastKey] = parsed;
            await fs.writeFile(settingsPathToUse, JSON.stringify(settings, null, 2));
            return { content: [{ type: "text" as const, text: `Setting updated: ${params.key} = ${JSON.stringify(parsed)}` }], details: { success: true } };
          } else if (params.action === "reset") {
            return { content: [{ type: "text" as const, text: "To reset settings, delete the settings.json file and run oh_project_init again." }], details: { success: true } };
          }

          return { content: [{ type: "text" as const, text: "Unknown action. Use: show, set, reset" }], details: { success: false } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Failed to access settings: ${err.message}\n\nRun oh_project_init to create settings.` }], details: { success: false } };
        }
      },
    });

    api.registerTool({

      name: "oh_version",
      label: "Version Info",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        let ohVersion = "unknown";
        try {
          const { stdout } = await execAsync("oh --version 2>/dev/null || echo unknown");
          ohVersion = stdout.trim() || "unknown";
        } catch { /* ignore */ }

        let output = `## Version Info\n\n`;
        output += `OpenHarness: ${ohVersion}\n`;
        output += `Node.js: ${process.version}\n`;
        output += `Platform: ${process.platform} ${process.arch}\n`;
        output += `OpenClaw Plugin API: 2026.3.24-beta.2\n`;
        output += `Plugin SDK: 2026.3.24-beta.2\n\n`;

        const repo = await detectRepo();
        if (repo) {
          output += `Repository: ${repo}\n`;
        }

        return { content: [{ type: "text" as const, text: output }], details: { success: true, ohVersion } };
      },
    });
}
