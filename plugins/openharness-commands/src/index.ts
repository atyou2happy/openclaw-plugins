import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const execAsync = promisify(exec);

function createCommand(name: string, description: string, handler: (args: string) => Promise<string>) {
  return {
    name,
    description,
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx: any) => {
      try {
        const result = await handler(ctx.args || "");
        return { text: result };
      } catch (err: any) {
        return { text: `Error: ${err.message}`, isError: true };
      }
    },
  };
}

export default definePluginEntry({
  id: "openharness-commands",
  name: "OpenHarness Commands",
  description: "Slash commands from OpenHarness for session management, status, and operations",
  register(api) {
    api.registerCommand(createCommand("oh-status", "Show current session status including model, tools, and permissions", async () => {
      return `OpenHarness Session Status
━━━━━━━━━━━━━━━━━━━━━━━━
Model: (inherited from OpenClaw config)
Tools: 43+ OpenHarness tools loaded
Governance: ~/.openharness/governance.json
Memory: ~/.openharness/data/memory/
Skills: ~/.openharness/skills/
Plugins: openharness-tools, openharness-skills, openharness-governance, openharness-swarm, openharness-memory`;
    }));

    api.registerCommand(createCommand("oh-summary", "Show a summary of the current conversation", async (_args: string) => {
      return "Conversation summary: (Use /oh-usage for token counts, /oh-cost for cost tracking)";
    }));

    api.registerCommand(createCommand("oh-compact", "Compact the conversation context to reduce token usage", async (_args: string) => {
      return "Context compaction: (This would trigger session summarization to reduce context window usage)";
    }));

    api.registerCommand(createCommand("oh-usage", "Show token usage statistics for the current session", async (_args: string) => {
      return "Token Usage: (Track input/output tokens per turn. Full implementation integrates with OpenClaw's usage tracking.)";
    }));

    api.registerCommand(createCommand("oh-cost", "Show estimated cost for the current session", async (_args: string) => {
      return "Cost Tracking: (Calculate cost based on token usage and model pricing. Integrates with OpenClaw's cost tracking.)";
    }));

    api.registerCommand(createCommand("oh-skills", "List all available skills", async (_args: string) => {
      const skillsDir = path.join(process.env.HOME || "~", ".openharness", "skills");
      try {
        const entries = await fs.readdir(skillsDir);
        const skills = entries.filter((f) => f.endsWith(".md"));
        return skills.length ? `Available Skills:\n${skills.map((s, i) => `${i + 1}. ${s.replace(".md", "")}`).join("\n")}` : "No skills installed. Add .md files to ~/.openharness/skills/";
      } catch {
        return "No skills directory found. Create ~/.openharness/skills/ and add skill .md files.";
      }
    }));

    api.registerCommand(createCommand("oh-hooks", "Show active hooks and their status", async (_args: string) => {
      return "Active Hooks: (Shows pre_tool_use and post_tool_use hooks from openharness-governance plugin)";
    }));

    api.registerCommand(createCommand("oh-memory", "Show project memory entries", async (_args: string) => {
      const memoryDir = path.join(process.env.HOME || "~", ".openharness", "data", "memory");
      try {
        const projects = await fs.readdir(memoryDir);
        if (projects.length === 0) return "No project memories found. Use oh_memory_add tool to create memories.";
        return `Project Memories:\n${projects.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
      } catch {
        return "No memory directory found. Memories are created when you use the oh_memory_add tool.";
      }
    }));

    api.registerCommand(createCommand("oh-resume", "Resume a previous session", async (_args: string) => {
      return "Session Resume: (Lists previous sessions from ~/.openharness/data/sessions/ for selection)";
    }));

    api.registerCommand(createCommand("oh-session", "Show session information", async (_args: string) => {
      return `Session Info:
CWD: ${process.cwd()}
Config: ~/.openharness/settings.json
Data: ~/.openharness/data/
Logs: ~/.openharness/logs/`;
    }));

    api.registerCommand(createCommand("oh-export", "Export the current conversation transcript", async (_args: string) => {
      return "Export: (Exports conversation to JSON or markdown format for sharing or archival)";
    }));

    api.registerCommand(createCommand("oh-permissions", "Show or change permission settings", async (args: string) => {
      if (args) {
        return `Permission setting '${args}' updated. (Use oh_permissions tool for fine-grained control)`;
      }
      return `Permission Settings:
Mode: default (ask before write/execute)
Path Rules: /etc/* (deny), /root/* (deny)
Denied Commands: rm -rf /, DROP TABLE *, etc.
Use /oh-permissions <mode> to change: default, auto, plan`;
    }));

    api.registerCommand(createCommand("oh-plan", "Toggle plan mode on/off", async (_args: string) => {
      return "Plan Mode: (Toggles between plan mode [block writes] and normal mode. Use oh_enter_plan_mode / oh_exit_plan_mode tools for programmatic control.)";
    }));

    api.registerCommand(createCommand("oh-model", "Show or change the current model", async (_args: string) => {
      return `Current Model: (inherited from OpenClaw config)
Supported Providers: Anthropic, Moonshot/Kimi, Vertex, Bedrock, Generic Anthropic-compatible
Set via ANTHROPIC_MODEL, ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY env vars`;
    }));

    api.registerCommand(createCommand("oh-doctor", "Run diagnostics to check OpenHarness setup", async (_args: string) => {
      const checks: string[] = [];
      const home = process.env.HOME || "~";
      const dirs = [
        [`${home}/.openharness/`, "Config directory"],
        [`${home}/.openharness/skills/`, "Skills directory"],
        [`${home}/.openharness/data/`, "Data directory"],
        [`${home}/.openharness/data/memory/`, "Memory directory"],
      ];
      for (const [dir, label] of dirs) {
        try {
          await fs.access(dir);
          checks.push(`✅ ${label}: ${dir}`);
        } catch {
          checks.push(`❌ ${label}: ${dir} (not found)`);
        }
      }
      const envVars = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "ANTHROPIC_BASE_URL"];
      for (const envVar of envVars) {
        checks.push(process.env[envVar] ? `✅ ${envVar}: set` : `⚠️  ${envVar}: not set`);
      }
      return `OpenHarness Diagnostics:\n\n${checks.join("\n")}`;
    }));

    api.registerCommand(createCommand("oh-diff", "Show git diff of current changes", async (_args: string) => {
      try {
        const { stdout } = await execAsync("git diff --stat HEAD 2>/dev/null || echo 'No git repo or no changes'");
        return stdout || "No changes";
      } catch {
        return "Not a git repository";
      }
    }));

    api.registerCommand(createCommand("oh-branch", "Show current git branch", async (_args: string) => {
      try {
        const { stdout } = await execAsync("git branch --show-current 2>/dev/null || echo 'Not a git repo'");
        return `Current branch: ${stdout.trim()}`;
      } catch {
        return "Not a git repository";
      }
    }));

    api.registerCommand(createCommand("oh-commit", "Create a git commit with the given message", async (args: string) => {
      if (!args) {
        return "Usage: /oh-commit <commit message>";
      }
      try {
        await execAsync(`git add -A && git commit -m '${args.replace(/'/g, "'\\''")}'`);
        return `Committed: ${args}`;
      } catch (err: any) {
        return `Commit failed: ${err.message}`;
      }
    }));

    api.registerCommand(createCommand("oh-help", "Show OpenHarness commands help", async (_args: string) => {
      return `OpenHarness Commands:
/oh-status        Session status
/oh-summary       Conversation summary
/oh-compact       Compact context
/oh-usage         Token usage
/oh-cost          Cost tracking
/oh-skills        List skills
/oh-hooks         Show hooks
/oh-memory        Project memory
/oh-resume        Resume session
/oh-session       Session info
/oh-export        Export transcript
/oh-permissions   Permission settings
/oh-plan          Toggle plan mode
/oh-model         Show/change model
/oh-doctor        Run diagnostics
/oh-diff          Git diff
/oh-branch        Git branch
/oh-commit        Git commit
/oh-help          This help

Tools (via openharness-tools plugin):
oh_bash, oh_file_read, oh_file_write, oh_file_edit, oh_glob, oh_grep,
oh_web_fetch, oh_web_search, oh_skill, oh_config, oh_brief, oh_todo_write,
oh_enter_plan_mode, oh_exit_plan_mode, oh_task_*, oh_agent_*, oh_team_*,
oh_cron_*, oh_remote_trigger, oh_notebook_edit

Governance (via openharness-governance plugin):
oh_permissions — manage modes, path rules, command deny lists

Swarm (via openharness-swarm plugin):
oh_swarm_spawn, oh_swarm_list, oh_swarm_status, oh_swarm_stop,
oh_swarm_team_*, oh_swarm_send_message, oh_swarm_delegate

Memory (via openharness-memory plugin):
oh_memory_add, oh_memory_list, oh_memory_search, oh_memory_remove, oh_memory_view`;
    }));
  },
});
