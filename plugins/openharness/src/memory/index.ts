import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";

function getProjectHash(cwd: string): string {
  return crypto.createHash("md5").update(cwd).digest("hex").slice(0, 8);
}

function getMemoryDir(cwd: string): string {
  return path.join(process.env.HOME || "~", ".openharness", "data", "memory", `project-${getProjectHash(cwd)}`);
}

function getMemoryEntrypoint(cwd: string): string {
  return path.join(getMemoryDir(cwd), "MEMORY.md");
}

async function ensureMemoryDir(cwd: string): Promise<string> {
  const dir = getMemoryDir(cwd);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function readEntrypoint(cwd: string): Promise<string> {
  try {
    return await fs.readFile(getMemoryEntrypoint(cwd), "utf-8");
  } catch {
    return "";
  }
}

async function writeEntrypoint(cwd: string, content: string) {
  await fs.mkdir(getMemoryDir(cwd), { recursive: true });
  await fs.writeFile(getMemoryEntrypoint(cwd), content, "utf-8");
}

async function updateEntrypoint(cwd: string, title: string, description: string) {
  let content = await readEntrypoint(cwd);
  if (!content) {
    content = "# Memory Index\n\n";
  }
  const entry = `- [${title}](./${title.replace(/\s+/g, "-").toLowerCase()}.md) — ${description}\n`;
  if (!content.includes(entry)) {
    content += entry;
    await writeEntrypoint(cwd, content);
  }
}

async function listMemoryFiles(cwd: string, maxFiles = 50): Promise<{ path: string; title: string; description: string; modifiedAt: number }[]> {
  try {
    const dir = getMemoryDir(cwd);
    const entries = await fs.readdir(dir);
    const files: { path: string; title: string; description: string; modifiedAt: number }[] = [];
    for (const entry of entries) {
      if (entry.endsWith(".md") && entry !== "MEMORY.md") {
        const filePath = path.join(dir, entry);
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf-8");
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const descMatch = content.match(/^>\s+(.+)$/m);
        files.push({
          path: filePath,
          title: titleMatch ? titleMatch[1].trim() : entry.replace(".md", ""),
          description: descMatch ? descMatch[1].trim() : "",
          modifiedAt: stat.mtimeMs,
        });
      }
    }
    return files.sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, maxFiles);
  } catch {
    return [];
  }
}

function findRelevantMemories(query: string, files: { path: string; title: string; description: string; modifiedAt: number }[], maxResults = 5): { path: string; title: string; description: string; content: string }[] {
  const q = query.toLowerCase().split(/\s+/);
  return files
    .map((f) => ({
      file: f,
      score: q.filter((word) => f.title.toLowerCase().includes(word) || f.description.toLowerCase().includes(word)).length,
    }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((r) => ({
      path: r.file.path,
      title: r.file.title,
      description: r.file.description,
      content: "",
    }));
}

export function registerMemory(api: any) {

    api.registerTool({
      name: "oh_memory_add",
      label: "Add Memory",

      parameters: Type.Object({
        title: Type.String({ description: "Memory title" }),
        content: Type.String({ description: "Memory content (markdown)" }),
        description: Type.Optional(Type.String({ description: "Short description for the index" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const dir = await ensureMemoryDir(cwd);
        const fileName = params.title.replace(/\s+/g, "-").toLowerCase() + ".md";
        const filePath = path.join(dir, fileName);
        const desc = params.description || params.content.slice(0, 100);
        const content = `# ${params.title}\n\n> ${desc}\n\n${params.content}\n`;
        await fs.writeFile(filePath, content, "utf-8");
        await updateEntrypoint(cwd, params.title, desc);
        return { content: [{ type: "text" as const, text: `Memory added: ${params.title}\nFile: ${filePath}\nDescription: ${desc}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_memory_list",
      label: "List Memories",

      parameters: Type.Object({
        max_files: Type.Optional(Type.Number({ description: "Maximum number of entries to list (default: 50)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const files = await listMemoryFiles(cwd, params.max_files || 50);
        if (files.length === 0) {
          return { content: [{ type: "text" as const, text: "No memory entries for this project. Use oh_memory_add to create one." }], details: { success: true } };
        }
        const list = files.map((f, i) => `${i + 1}. **${f.title}** — ${f.description}\n   Modified: ${new Date(f.modifiedAt).toISOString()}\n   File: ${f.path}`).join("\n");
        return { content: [{ type: "text" as const, text: `Memory entries (${files.length}):\n\n${list}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_memory_search",
      label: "Search Memories",

      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        max_results: Type.Optional(Type.Number({ description: "Maximum results (default: 5)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const files = await listMemoryFiles(cwd);
        const matches = findRelevantMemories(params.query, files, params.max_results || 5);
        if (matches.length === 0) {
          return { content: [{ type: "text" as const, text: `No memories matching '${params.query}'` }], details: { success: true } };
        }
        const results = await Promise.all(matches.map(async (m) => {
          const content = await fs.readFile(m.path, "utf-8");
          return `## ${m.title}\n${content}\n`;
        }));
        return { content: [{ type: "text" as const, text: `Memories matching '${params.query}':\n\n${results.join("\n---\n\n")}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_memory_remove",
      label: "Remove Memory",

      parameters: Type.Object({
        title: Type.String({ description: "Title of the memory to remove" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const cwd = process.cwd();
        const dir = getMemoryDir(cwd);
        const fileName = params.title.replace(/\s+/g, "-").toLowerCase() + ".md";
        const filePath = path.join(dir, fileName);
        try {
          await fs.unlink(filePath);
          let index = await readEntrypoint(cwd);
          index = index.split("\n").filter((line) => !line.includes(`[${params.title}]`)).join("\n");
          await writeEntrypoint(cwd, index);
          return { content: [{ type: "text" as const, text: `Memory removed: ${params.title}` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Memory not found: ${params.title}` }], details: { success: true } };
        }
      },
    });

    api.registerTool({
      name: "oh_memory_view",
      label: "View Memory Index",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        const cwd = process.cwd();
        const content = await readEntrypoint(cwd);
        if (!content) {
          return { content: [{ type: "text" as const, text: "No MEMORY.md index for this project. Add memories with oh_memory_add." }], details: { success: true } };
        }
        return { content: [{ type: "text" as const, text: content }], details: { success: true } };
      },
    });

    api.on("before_prompt_build", async (event: any, ctx: any) => {
      const cwd = process.cwd();
      const files = await listMemoryFiles(cwd, 5);
      if (files.length === 0) return;
      const query = (event.prompt || "").toLowerCase();
      const relevant = findRelevantMemories(query, files, 3);
      if (relevant.length === 0) return;
      const memorySection = (await Promise.all(relevant.map(async (m) => {
        const content = await fs.readFile(m.path, "utf-8");
        return `---\n## Memory: ${m.title}\n${content.slice(0, 500)}\n---`;
      }))).join("\n\n");
      event.context = (event.context || "") + "\n\n## Project Memory\n" + memorySection;
    });
}
