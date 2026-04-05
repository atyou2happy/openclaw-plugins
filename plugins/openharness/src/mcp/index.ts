import { Type } from "@sinclair/typebox";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const execAsync = promisify(exec);

interface McpServerConfig {
  type: "stdio" | "http" | "ws";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

interface McpServerState {
  name: string;
  config: McpServerConfig;
  status: "disconnected" | "connecting" | "connected" | "failed";
  tools: McpToolInfo[];
  resources: McpResourceInfo[];
  pid?: number;
  error?: string;
  lastConnected?: string;
}

interface McpToolInfo {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpResourceInfo {
  serverName: string;
  name: string;
  uri: string;
  description: string;
}

const configPath = path.join(process.env.HOME || "~", ".openharness", "data", "mcp", "servers.json");
const statePath = path.join(process.env.HOME || "~", ".openharness", "data", "mcp", "state.json");

async function loadServerConfigs(): Promise<Record<string, McpServerConfig>> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function saveServerConfigs(configs: Record<string, McpServerConfig>) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(configs, null, 2));
}

const serverStates = new Map<string, McpServerState>();

async function loadPersistedStates() {
  try {
    const content = await fs.readFile(statePath, "utf-8");
    const data = JSON.parse(content) as McpServerState[];
    for (const state of data) {
      state.status = "disconnected";
      serverStates.set(state.name, state);
    }
  } catch {
    // no persisted states
  }
}

async function persistStates() {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const data = Array.from(serverStates.values());
  await fs.writeFile(statePath, JSON.stringify(data, null, 2));
}

async function connectStdioServer(name: string, config: McpServerConfig): Promise<McpServerState> {
  const state: McpServerState = {
    name,
    config,
    status: "connecting",
    tools: [],
    resources: [],
  };

  if (!config.command) {
    state.status = "failed";
    state.error = "Missing 'command' for stdio server";
    serverStates.set(name, state);
    return state;
  }

  try {
    const child = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    state.pid = child.pid;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout (10s)"));
      }, 10000);

      let initialized = false;
      let outputBuffer = "";

      child.stdout?.on("data", (data: Buffer) => {
        outputBuffer += data.toString();
        if (!initialized) {
          initialized = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      child.stderr?.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg && state.status === "connecting") {
          state.error = msg;
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        state.status = "failed";
        state.error = err.message;
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (state.status === "connecting") {
          state.status = "failed";
          state.error = `Process exited with code ${code}`;
          reject(new Error(state.error));
        }
      });
    });

    state.status = "connected";
    state.lastConnected = new Date().toISOString();
    state.error = undefined;
  } catch (err: any) {
    state.status = "failed";
    state.error = err.message || String(err);
  }

  serverStates.set(name, state);
  await persistStates();
  return state;
}

export function registerMcp(api: any) {
  api.registerTool({
      name: "oh_mcp_disconnect",
      label: "Disconnect MCP Server",

      parameters: Type.Object({
        name: Type.String({ description: "Name of the MCP server to disconnect" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const state = serverStates.get(params.name);
        if (!state) {
          return { content: [{ type: "text" as const, text: `Server '${params.name}' not found` }], details: { success: true } };
        }
        if (state.pid) {
          try {
            process.kill(state.pid, "SIGTERM");
          } catch { /* already dead */ }
        }
        state.status = "disconnected";
        state.pid = undefined;
        serverStates.set(params.name, state);
        await persistStates();
        return { content: [{ type: "text" as const, text: `Disconnected from '${params.name}'` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_mcp_list_servers",
      label: "List MCP Servers",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        const configs = await loadServerConfigs();
        const entries = Object.entries(configs);
        if (entries.length === 0) {
          return { content: [{ type: "text" as const, text: "No MCP servers configured. Use oh_mcp_connect to add one." }], details: { success: true } };
        }
        const lines = entries.map(([name, config]) => {
          const state = serverStates.get(name);
          const status = state?.status || "disconnected";
          const toolCount = state?.tools?.length || 0;
          const resourceCount = state?.resources?.length || 0;
          return `[${status}] ${name} (${config.type})${config.url ? ` → ${config.url}` : ""}${config.command ? ` → ${config.command}` : ""} | ${toolCount} tools, ${resourceCount} resources`;
        });
        return { content: [{ type: "text" as const, text: `MCP Servers (${entries.length}):\n\n${lines.join("\n")}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_mcp_list_tools",
      label: "List MCP Tools",

      parameters: Type.Object({
        server: Type.Optional(Type.String({ description: "Filter by server name (empty = all servers)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const allTools: McpToolInfo[] = [];
        for (const [name, state] of serverStates) {
          if (state.status !== "connected") continue;
          if (params.server && name !== params.server) continue;
          allTools.push(...state.tools);
        }
        if (allTools.length === 0) {
          return { content: [{ type: "text" as const, text: params.server ? `No tools from server '${params.server}'. Ensure it's connected.` : "No MCP tools available. Connect servers with oh_mcp_connect." }], details: { success: true } };
        }
        const lines = allTools.map((t, i) => `${i + 1}. **${t.name}** (from ${t.serverName})\n   ${t.description}\n   Schema: ${JSON.stringify(t.inputSchema).slice(0, 200)}`);
        return { content: [{ type: "text" as const, text: `MCP Tools (${allTools.length}):\n\n${lines.join("\n\n")}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_mcp_call_tool",
      label: "Call MCP Tool",

      parameters: Type.Object({
        server: Type.String({ description: "MCP server name" }),
        tool: Type.String({ description: "Tool name to call" }),
        arguments: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Tool arguments as key-value pairs" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const state = serverStates.get(params.server);
        if (!state) {
          return { content: [{ type: "text" as const, text: `Server '${params.server}' not found. Use oh_mcp_list_servers to see available servers.` }], details: { success: true } };
        }
        if (state.status !== "connected") {
          return { content: [{ type: "text" as const, text: `Server '${params.server}' is ${state.status}. Reconnect with oh_mcp_connect.` }], details: { success: true } };
        }
        const toolInfo = state.tools.find((t) => t.name === params.tool);
        if (!toolInfo) {
          const available = state.tools.map((t) => t.name).join(", ");
          return { content: [{ type: "text" as const, text: `Tool '${params.tool}' not found on server '${params.server}'. Available: ${available}` }], details: { success: true } };
        }
        try {
          const argsJson = JSON.stringify(params.arguments || {});
          const { stdout, stderr } = await execAsync(
            `echo '${argsJson.replace(/'/g, "'\\''")}' | ${state.config.command} --tool ${params.tool}`,
            { timeout: 30000, env: { ...process.env, ...state.config.env } }
          );
          return { content: [{ type: "text" as const, text: stdout || stderr || "(tool completed with no output)" }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Tool call failed: ${err.message}\nNote: For full MCP protocol support, ensure the MCP server is running and accessible.` }], details: { success: true } };
        }
      },
    });

    api.registerTool({
      name: "oh_mcp_list_resources",
      label: "List MCP Resources",

      parameters: Type.Object({
        server: Type.Optional(Type.String({ description: "Filter by server name" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const allResources: McpResourceInfo[] = [];
        for (const [name, state] of serverStates) {
          if (state.status !== "connected") continue;
          if (params.server && name !== params.server) continue;
          allResources.push(...state.resources);
        }
        if (allResources.length === 0) {
          return { content: [{ type: "text" as const, text: "No MCP resources available." }], details: { success: true } };
        }
        const lines = allResources.map((r, i) => `${i + 1}. **${r.name}** (from ${r.serverName})\n   URI: ${r.uri}\n   ${r.description}`);
        return { content: [{ type: "text" as const, text: `MCP Resources (${allResources.length}):\n\n${lines.join("\n\n")}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_mcp_read_resource",
      label: "Read MCP Resource",

      parameters: Type.Object({
        server: Type.String({ description: "MCP server name" }),
        uri: Type.String({ description: "Resource URI to read" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const state = serverStates.get(params.server);
        if (!state) {
          return { content: [{ type: "text" as const, text: `Server '${params.server}' not found` }], details: { success: true } };
        }
        if (state.status !== "connected") {
          return { content: [{ type: "text" as const, text: `Server '${params.server}' is ${state.status}` }], details: { success: true } };
        }
        const resource = state.resources.find((r) => r.uri === params.uri);
        if (!resource) {
          return { content: [{ type: "text" as const, text: `Resource '${params.uri}' not found on server '${params.server}'` }], details: { success: true } };
        }
        return { content: [{ type: "text" as const, text: `Resource: ${resource.name}\nURI: ${resource.uri}\n\n(Resource content would be fetched via MCP protocol in full implementation)` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_mcp_server_status",
      label: "MCP Server Status",

      parameters: Type.Object({
        name: Type.String({ description: "Server name" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const state = serverStates.get(params.name);
        if (!state) {
          return { content: [{ type: "text" as const, text: `Server '${params.name}' not found` }], details: { success: true } };
        }
        const config = state.config;
        const lines = [
          `Server: ${state.name}`,
          `Status: ${state.status}`,
          `Transport: ${config.type}`,
          config.command ? `Command: ${config.command} ${(config.args || []).join(" ")}` : "",
          config.url ? `URL: ${config.url}` : "",
          state.pid ? `PID: ${state.pid}` : "",
          state.lastConnected ? `Last Connected: ${state.lastConnected}` : "",
          state.error ? `Error: ${state.error}` : "",
          `Tools (${state.tools.length}): ${state.tools.map((t) => t.name).join(", ") || "none"}`,
          `Resources (${state.resources.length}): ${state.resources.map((r) => r.uri).join(", ") || "none"}`,
        ].filter(Boolean);
        return { content: [{ type: "text" as const, text: lines.join("\n") }], details: { success: true } };
      },
    });
}
