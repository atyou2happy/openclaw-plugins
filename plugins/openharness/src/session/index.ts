import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

interface SessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface SessionData {
  id: string;
  parentId?: string;
  branch?: string;
  cwd: string;
  model?: string;
  messages: SessionMessage[];
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  tags: string[];
}

function getProjectSessionDir(cwd: string): string {
  const hash = crypto.createHash("sha1").update(path.resolve(cwd)).digest("hex").slice(0, 12);
  return path.join(process.env.HOME || "~", ".openharness", "data", "sessions", `project-${hash}`);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function listSessionFiles(sessionDir: string, limit = 50): Promise<string[]> {
  try {
    const entries = await fs.readdir(sessionDir);
    return entries
      .filter((e) => e.startsWith("session-") && e.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function loadSession(filePath: string): Promise<SessionData | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function formatSessionList(sessions: (SessionData & { fileName: string })[]): string {
  return sessions.map((s, i) => {
    const date = new Date(s.updatedAt).toLocaleString();
    const branch = s.branch ? ` [${s.branch}]` : "";
    const parent = s.parentId ? ` (branch of ${s.parentId.slice(0, 12)}...)` : "";
    return `${i + 1}. ${s.id}${branch}${parent}\n   Summary: ${s.summary || "(no summary)"}\n   Messages: ${s.messageCount} | Updated: ${date} | Tags: ${s.tags.join(", ") || "none"}`;
  }).join("\n\n");
}

function messagesToMarkdown(messages: SessionMessage[]): string {
  return messages.map((m) => {
    const header = m.role === "user" ? "**User**" : m.role === "assistant" ? "**Assistant**" : "**System**";
    return `### ${header} (${m.timestamp})\n\n${m.content}`;
  }).join("\n\n---\n\n");
}

export function registerSession(api: any) {

    api.registerTool({
      name: "oh_session_save",
      label: "Save Session",

      parameters: Type.Object({
        messages: Type.Array(Type.Object({
          role: Type.String({ description: "Message role: user, assistant, or system" }),
          content: Type.String({ description: "Message content" }),
        }), { description: "Conversation messages to save" }),
        summary: Type.Optional(Type.String({ description: "Session summary description" })),
        tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for categorization" })),
        name: Type.Optional(Type.String({ description: "Custom session name (default: auto-generated)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const sessionDir = getProjectSessionDir(cwd);
        await ensureDir(sessionDir);

        const id = params.name || `sess_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const now = new Date().toISOString();
        const messages: SessionMessage[] = params.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: now,
        }));

        const firstUserMsg = messages.find((m) => m.role === "user");
        const summary = params.summary || (firstUserMsg ? firstUserMsg.content.slice(0, 80) : "No summary");

        const session: SessionData = {
          id,
          cwd,
          messages,
          summary,
          createdAt: now,
          updatedAt: now,
          messageCount: messages.length,
          tags: params.tags || [],
        };

        const filePath = path.join(sessionDir, `session-${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(session, null, 2));

        const latestPath = path.join(sessionDir, "latest.json");
        await fs.writeFile(latestPath, JSON.stringify(session, null, 2));

        return {
          content: [{ type: "text" as const, text: `Session saved: ${id}\nMessages: ${messages.length}\nSummary: ${summary}\nFile: ${filePath}` }],
          details: { success: true, sessionId: id, path: filePath },
        };
      },
    });

    api.registerTool({
      name: "oh_session_load",
      label: "Load Session",

      parameters: Type.Object({
        session_id: Type.String({ description: "Session ID to load" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const sessionDir = getProjectSessionDir(cwd);
        const filePath = path.join(sessionDir, `session-${params.session_id}.json`);

        const session = await loadSession(filePath);
        if (!session) {
          const sessions = await listSessionFiles(sessionDir, 10);
          const available = sessions.map((s) => s.replace("session-", "").replace(".json", "")).join(", ");
          return {
            content: [{ type: "text" as const, text: `Session '${params.session_id}' not found.\nAvailable: ${available || "(none)"}` }],
            details: { success: true },
          };
        }

        const messagesPreview = session.messages.slice(-5).map((m) => `[${m.role}] ${m.content.slice(0, 100)}...`).join("\n");
        return {
          content: [{
            type: "text" as const,
            text: `Session: ${session.id}\nSummary: ${session.summary}\nMessages: ${session.messageCount}\nTags: ${session.tags.join(", ")}\nCreated: ${session.createdAt}\nUpdated: ${session.updatedAt}\n\nLast 5 messages:\n${messagesPreview}\n\nFull message history available. Use oh_session_export to get the complete transcript.`,
          }],
          details: { success: true, session },
        };
      },
    });

    api.registerTool({
      name: "oh_session_list",
      label: "List Sessions",

      parameters: Type.Object({
        limit: Type.Optional(Type.Number({ description: "Maximum sessions to list (default: 20)" })),
        tag: Type.Optional(Type.String({ description: "Filter by tag" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const sessionDir = getProjectSessionDir(cwd);
        const files = await listSessionFiles(sessionDir, params.limit || 20);

        if (files.length === 0) {
          return { content: [{ type: "text" as const, text: "No saved sessions for this project. Use oh_session_save to create one." }], details: { success: true } };
        }

        const sessions: (SessionData & { fileName: string })[] = [];
        for (const file of files) {
          const session = await loadSession(path.join(sessionDir, file));
          if (session) {
            if (params.tag && !session.tags.includes(params.tag)) continue;
            sessions.push({ ...session, fileName: file });
          }
        }

        if (sessions.length === 0) {
          return { content: [{ type: "text" as const, text: params.tag ? `No sessions with tag '${params.tag}'` : "No sessions found" }], details: { success: true } };
        }

        return {
          content: [{ type: "text" as const, text: `Sessions (${sessions.length}):\n\n${formatSessionList(sessions)}` }],
          details: { success: true, count: sessions.length },
        };
      },
    });

    api.registerTool({
      name: "oh_session_export",
      label: "Export Session",

      parameters: Type.Object({
        session_id: Type.Optional(Type.String({ description: "Session ID to export (default: latest)" })),
        format: Type.Optional(Type.String({ description: "Export format", enum: ["json", "markdown"], default: "json" })),
        output_path: Type.Optional(Type.String({ description: "Output file path (default: stdout)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const sessionDir = getProjectSessionDir(cwd);

        let filePath: string;
        if (params.session_id) {
          filePath = path.join(sessionDir, `session-${params.session_id}.json`);
        } else {
          filePath = path.join(sessionDir, "latest.json");
        }

        const session = await loadSession(filePath);
        if (!session) {
          return { content: [{ type: "text" as const, text: "Session not found" }], details: { success: true } };
        }

        let output: string;
        if (params.format === "markdown") {
          output = `# Session Export: ${session.id}\n\n**Summary:** ${session.summary}\n**Created:** ${session.createdAt}\n**Messages:** ${session.messageCount}\n**Tags:** ${session.tags.join(", ")}\n\n---\n\n${messagesToMarkdown(session.messages)}`;
        } else {
          output = JSON.stringify(session, null, 2);
        }

        if (params.output_path) {
          await fs.writeFile(params.output_path, output, "utf-8");
          return { content: [{ type: "text" as const, text: `Session exported to ${params.output_path} (${output.length} bytes, ${params.format} format)` }], details: { success: true } };
        }

        return {
          content: [{ type: "text" as const, text: `Session Export (${params.format}):\n\n${output.slice(0, 5000)}${output.length > 5000 ? "\n\n...[truncated, use output_path to save full export]" : ""}` }],
          details: { success: true, size: output.length },
        };
      },
    });

    api.registerTool({
      name: "oh_session_branch",
      label: "Branch Session",

      parameters: Type.Object({
        parent_id: Type.String({ description: "Parent session ID to branch from" }),
        branch_name: Type.Optional(Type.String({ description: "Branch name (default: auto-generated)" })),
        truncate_at: Type.Optional(Type.Number({ description: "Truncate messages at this index (default: keep all)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const sessionDir = getProjectSessionDir(cwd);
        await ensureDir(sessionDir);

        const parentPath = path.join(sessionDir, `session-${params.parent_id}.json`);
        const parent = await loadSession(parentPath);
        if (!parent) {
          return { content: [{ type: "text" as const, text: `Parent session '${params.parent_id}' not found` }], details: { success: true } };
        }

        const branchId = params.branch_name || `branch_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const now = new Date().toISOString();
        const messages = params.truncate_at
          ? parent.messages.slice(0, params.truncate_at)
          : [...parent.messages];

        const branch: SessionData = {
          id: branchId,
          parentId: parent.id,
          branch: params.branch_name || branchId,
          cwd,
          messages,
          summary: `Branch of ${parent.id}${params.truncate_at ? ` (truncated at msg ${params.truncate_at})` : ""}`,
          createdAt: now,
          updatedAt: now,
          messageCount: messages.length,
          tags: [...parent.tags, "branch"],
        };

        const filePath = path.join(sessionDir, `session-${branchId}.json`);
        await fs.writeFile(filePath, JSON.stringify(branch, null, 2));

        return {
          content: [{
            type: "text" as const,
            text: `Session branched:\nBranch: ${branchId}\nParent: ${parent.id}\nMessages: ${messages.length} (from parent)${params.truncate_at ? ` (truncated at ${params.truncate_at})` : ""}`,
          }],
          details: { success: true, branchId, parentId: parent.id },
        };
      },
    });

    api.registerTool({
      name: "oh_session_summary",
      label: "Session Summary",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        const cwd = process.cwd();
        const sessionDir = getProjectSessionDir(cwd);

        const latestPath = path.join(sessionDir, "latest.json");
        const session = await loadSession(latestPath);
        if (!session) {
          return { content: [{ type: "text" as const, text: "No sessions found for this project." }], details: { success: true } };
        }

        const userMessages = session.messages.filter((m) => m.role === "user");
        const assistantMessages = session.messages.filter((m) => m.role === "assistant");
        const topics = userMessages.map((m) => m.content.slice(0, 60)).filter(Boolean);

        return {
          content: [{
            type: "text" as const,
            text: `Session Summary\n${"━".repeat(40)}\nSession: ${session.id}\nCreated: ${session.createdAt}\nLast Updated: ${session.updatedAt}\n\nMessages: ${session.messageCount} total\n  User: ${userMessages.length}\n  Assistant: ${assistantMessages.length}\n\nTopics Discussed:\n${topics.map((t) => `  - ${t}`).join("\n")}\n\nTags: ${session.tags.join(", ") || "none"}`,
          }],
          details: { success: true },
        };
      },
    });
}
