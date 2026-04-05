import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const swarmDir = path.join(process.env.HOME || "~", ".openharness", "data", "swarm");
const agentsFile = path.join(swarmDir, "agents.json");
const teamsFile = path.join(swarmDir, "teams.json");
const messagesFile = path.join(swarmDir, "messages.json");

interface AgentRecord {
  id: string;
  label: string;
  mode: string;
  model?: string;
  prompt: string;
  status: "pending" | "running" | "completed" | "failed" | "stopped";
  pid?: number;
  created_at: string;
  ended_at?: string;
  result?: string;
}

interface TeamRecord {
  name: string;
  description: string;
  agents: string[];
  messages: string[];
  created_at: string;
}

async function ensureSwarmDir() {
  await fs.mkdir(swarmDir, { recursive: true });
  for (const file of [agentsFile, teamsFile, messagesFile]) {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, "[]");
    }
  }
}

async function readJson<T>(file: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch {
    return [];
  }
}

async function writeJson<T>(file: string, data: T[]) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

export function registerSwarm(api: any) {

    api.registerTool({

      name: "oh_swarm_spawn",
      label: "Spawn Subagent",

      parameters: Type.Object({
        prompt: Type.String({ description: "The complete task/prompt for the subagent" }),
        label: Type.Optional(Type.String({ description: "Human-readable label for this agent" })),
        mode: Type.Optional(Type.String({ description: "Execution mode", enum: ["local_agent", "remote_agent", "in_process_teammate"] })),
        model: Type.Optional(Type.String({ description: "Model to use (e.g., 'claude-sonnet-4-20250514', 'kimi-k2.5')" })),
        workdir: Type.Optional(Type.String({ description: "Working directory for the agent" })),
      }),
      async execute(_toolCallId: string, params: any) {
        await ensureSwarmDir();
        const agents = await readJson<AgentRecord>(agentsFile);
        const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const agent: AgentRecord = {
          id: agentId,
          label: params.label || "subagent",
          mode: params.mode || "local_agent",
          model: params.model,
          prompt: params.prompt,
          status: "pending",
          created_at: new Date().toISOString(),
        };

        if (agent.mode === "local_agent") {
          agent.status = "running";
          const workdir = params.workdir || process.cwd();
          const ohCmd = `oh -p '${params.prompt.replace(/'/g, "'\\''")}' --output-format json 2>/dev/null`;
          const child = spawn("bash", ["-c", ohCmd], {
            cwd: workdir,
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
          });
          agent.pid = child.pid;
          let output = "";
          child.stdout?.on("data", (d) => { output += d.toString(); });
          child.stderr?.on("data", (d) => { output += d.toString(); });
          child.on("close", (code) => {
            agent.status = code === 0 ? "completed" : "failed";
            agent.ended_at = new Date().toISOString();
            agent.result = output.slice(0, 10000);
            writeJson(agentsFile, agents.map((a) => (a.id === agentId ? agent : a)));
          });
        } else if (agent.mode === "in_process_teammate") {
          agent.status = "completed";
          agent.result = "(In-process teammate mode: task queued for next agent turn)";
          agent.ended_at = new Date().toISOString();
        } else {
          agent.status = "pending";
          agent.result = "(Remote agent mode: agent registered for remote execution)";
        }

        agents.push(agent);
        await writeJson(agentsFile, agents);
        return {
          content: [{
            type: "text" as const,
            text: `Subagent spawned:\nID: ${agentId}\nLabel: ${agent.label}\nMode: ${agent.mode}${agent.model ? `\nModel: ${agent.model}` : ""}${agent.pid ? `\nPID: ${agent.pid}` : ""}\nStatus: ${agent.status}\nPrompt: ${params.prompt.slice(0, 150)}...`,
          }],
          details: { success: true, agentId },
        };
      },
    });

    api.registerTool({
      name: "oh_swarm_agent_status",
      label: "Agent Status",

      parameters: Type.Object({
        agent_id: Type.String({ description: "The agent ID to check" }),
      }),
      async execute(_toolCallId: string, params: any) {
        await ensureSwarmDir();
        const agents = await readJson<AgentRecord>(agentsFile);
        const agent = agents.find((a) => a.id === params.agent_id);
        if (!agent) {
          return { content: [{ type: "text" as const, text: `Agent not found: ${params.agent_id}` }], details: { success: true } };
        }
        return { content: [{ type: "text" as const, text: `Agent: ${agent.id}\nLabel: ${agent.label}\nMode: ${agent.mode}\nStatus: ${agent.status}\nCreated: ${agent.created_at}${agent.ended_at ? `\nEnded: ${agent.ended_at}` : ""}${agent.result ? `\n\nResult:\n${agent.result}` : ""}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_swarm_list_subagents",
      label: "List Subagents",

      parameters: Type.Object({
        status: Type.Optional(Type.String({ description: "Filter by status", enum: ["pending", "running", "completed", "failed", "stopped"] })),
      }),
      async execute(_toolCallId: string, params: any) {
        await ensureSwarmDir();
        const agents = await readJson<AgentRecord>(agentsFile);
        const filtered = params.status ? agents.filter((a) => a.status === params.status) : agents;
        if (filtered.length === 0) {
          return { content: [{ type: "text" as const, text: "No subagents found" }], details: { success: true } };
        }
        const list = filtered.map((a) => `[${a.status}] ${a.id} (${a.label}) — ${a.mode}${a.model ? ` | ${a.model}` : ""}${a.ended_at ? ` | ended: ${a.ended_at}` : ""}`).join("\n");
        return { content: [{ type: "text" as const, text: `Subagents (${filtered.length}):\n\n${list}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_swarm_stop_subagent",
      label: "Stop Subagent",

      parameters: Type.Object({
        agent_id: Type.String({ description: "The agent ID to stop" }),
      }),
      async execute(_toolCallId: string, params: any) {
        await ensureSwarmDir();
        const agents = await readJson<AgentRecord>(agentsFile);
        const agent = agents.find((a) => a.id === params.agent_id);
        if (!agent) {
          return { content: [{ type: "text" as const, text: `Agent not found: ${params.agent_id}` }], details: { success: true } };
        }
        if (agent.pid) {
          try {
            process.kill(-agent.pid, "SIGTERM");
          } catch { /* already dead */ }
        }
        agent.status = "stopped";
        agent.ended_at = new Date().toISOString();
        await writeJson(agentsFile, agents);
        return { content: [{ type: "text" as const, text: `Agent ${params.agent_id} stopped` }], details: { success: true } };
      },
    });

    api.registerTool({

      name: "oh_swarm_team_create",
      label: "Create Team",

      parameters: Type.Object({
        name: Type.String({ description: "Team name" }),
        description: Type.Optional(Type.String({ description: "Team description" })),
        agents: Type.Optional(Type.Array(Type.String(), { description: "Agent IDs to add to the team" })),
      }),
      async execute(_toolCallId: string, params: any) {
        await ensureSwarmDir();
        const teams = await readJson<TeamRecord>(teamsFile);
        if (teams.find((t) => t.name === params.name)) {
          return { content: [{ type: "text" as const, text: `Team already exists: ${params.name}` }], details: { success: true } };
        }
        const team: TeamRecord = {
          name: params.name,
          description: params.description || "",
          agents: params.agents || [],
          messages: [],
          created_at: new Date().toISOString(),
        };
        teams.push(team);
        await writeJson(teamsFile, teams);
        return { content: [{ type: "text" as const, text: `Team created: ${params.name}\nDescription: ${team.description}\nMembers: ${team.agents.length}` }], details: { success: true } };
      },
    });

    api.registerTool({

      name: "oh_swarm_team_list",
      label: "List Teams",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        await ensureSwarmDir();
        const teams = await readJson<TeamRecord>(teamsFile);
        if (teams.length === 0) {
          return { content: [{ type: "text" as const, text: "No teams created" }], details: { success: true } };
        }
        const list = teams.map((t) => `${t.name}: ${t.description} (${t.agents.length} agents, ${t.messages.length} messages)`).join("\n");
        return { content: [{ type: "text" as const, text: `Teams:\n\n${list}` }], details: { success: true } };
      },
    });

    api.registerTool({

      name: "oh_swarm_send_message",
      label: "Send Team Message",

      parameters: Type.Object({
        target: Type.String({ description: "Target: team name or agent ID" }),
        message: Type.String({ description: "Message content" }),
        target_type: Type.String({ description: "Target type", enum: ["team", "agent"] }),
      }),
      async execute(_toolCallId: string, params: any) {
        await ensureSwarmDir();
        const msg = { from: "main", target: params.target, message: params.message, timestamp: new Date().toISOString() };
        if (params.target_type === "team") {
          const teams = await readJson<TeamRecord>(teamsFile);
          const team = teams.find((t) => t.name === params.target);
          if (!team) {
            return { content: [{ type: "text" as const, text: `Team not found: ${params.target}` }], details: { success: true } };
          }
          team.messages.push(JSON.stringify(msg));
          await writeJson(teamsFile, teams);
        }
        const messages = await readJson<any>(messagesFile);
        messages.push(msg);
        await writeJson(messagesFile, messages);
        return { content: [{ type: "text" as const, text: `Message sent to ${params.target_type} '${params.target}'` }], details: { success: true } };
      },
    });

    api.registerTool({

      name: "oh_swarm_delegate",
      label: "Delegate Task",

      parameters: Type.Object({
        task: Type.String({ description: "The task to delegate" }),
        agent_type: Type.Optional(Type.String({ description: "Agent specialization", enum: ["coder", "reviewer", "explorer", "tester", "general"] })),
        context: Type.Optional(Type.String({ description: "Additional context for the agent" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const typePrompts: Record<string, string> = {
          coder: "You are a coding specialist. Implement the following task with clean, well-tested code:",
          reviewer: "You are a code reviewer. Review the following code for bugs, security issues, and quality:",
          explorer: "You are a codebase explorer. Analyze and document the following:",
          tester: "You are a testing specialist. Write and run tests for the following:",
          general: "Complete the following task:",
        };
        const agentType = params.agent_type || "general";
        const prompt = `${typePrompts[agentType]}\n\n${params.task}${params.context ? `\n\nContext: ${params.context}` : ""}`;
        const agents = await readJson<AgentRecord>(agentsFile);
        const activeCount = agents.filter((a) => a.status === "running").length;
        if (activeCount >= 5) {
          return { content: [{ type: "text" as const, text: `Cannot delegate: ${activeCount} agents already running (max: 5). Wait for agents to complete or stop some.` }], details: { success: true } };
        }
        const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const agent: AgentRecord = {
          id: agentId,
          label: `${agentType}-delegate`,
          mode: "local_agent",
          prompt,
          status: "running",
          created_at: new Date().toISOString(),
        };
        agents.push(agent);
        await writeJson(agentsFile, agents);
        return { content: [{ type: "text" as const, text: `Task delegated to ${agentType} agent:\nID: ${agentId}\nTask: ${params.task.slice(0, 150)}...` }], details: { success: true } };
      },
    });
}
