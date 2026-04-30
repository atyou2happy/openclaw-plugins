import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

const GRAPHIFY_TIMEOUT = 120_000;

// Resolve script path relative to this source file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, "..", "..", "scripts", "graphify_query.py");

export class CodeGraphTool implements AnyAgentTool {
  name = "code_graph";
  label = "Code Graph Analysis";
  description =
    "Analyze code dependencies and impact using graphify knowledge graphs. Actions: build (create/update graph), impact (analyze change scope for Plan Gate), trace (trace dependency path for Debug), verify (verify completeness for Code Review). Prevents missing related changes.";

  parameters = z.object({
    action: z
      .enum(["build", "impact", "trace", "verify"])
      .describe("Action: build graph, analyze impact, trace path, or verify completeness"),
    projectDir: z.string().describe("Absolute path to the project directory"),
    target: z
      .string()
      .optional()
      .describe("Module, file, or concept name to analyze"),
    targetB: z
      .string()
      .optional()
      .describe("Second target for trace action (path from A to B)"),
    mode: z
      .enum(["bfs", "dfs"])
      .optional()
      .describe("Traversal mode: bfs (broad context) or dfs (deep path). Default: bfs for verify, dfs for impact"),
    budget: z
      .number()
      .optional()
      .describe("Token budget for query results (default: 2000)"),
  });

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    // Parameter validation first (before graphify check)
    if (input.action !== "build" && !input.target) {
      return {
        content: [
          { type: "text" as const, text: "\`target\` is required for " + input.action + ". Provide the module or file name." },
        ],
        details: { success: false, error: "Missing target" },
      };
    }
    if (input.action === "trace" && !input.targetB) {
      return {
        content: [
          { type: "text" as const, text: "Both \`target\` and \`targetB\` are required for trace." },
        ],
        details: { success: false, error: "Missing targetB" },
      };
    }

    const installed = await this.checkGraphify();
    if (!installed) {
      return {
        content: [
          {
            type: "text" as const,
            text: "❌ graphify not installed.\n\nInstall: `pip install graphifyy`\nThen run `build` action to create the knowledge graph.",
          },
        ],
        details: { success: false, error: "graphify not installed" },
      };
    }

    switch (input.action) {
      case "build":
        return this.actionBuild(input);
      case "impact":
        return this.actionQuery(input, "impact");
      case "trace":
        return this.actionQuery(input, "trace");
      case "verify":
        return this.actionQuery(input, "verify");
    }
  }

  private async actionBuild(input: z.infer<typeof this.parameters>) {
    const { projectDir } = input;
    const graphDir = join(projectDir, "graphify-out");
    const graphJson = join(graphDir, "graph.json");

    try {
      const isUpdate = existsSync(graphJson);
      const cmd = isUpdate
        ? `cd "${projectDir}" && python3 -m graphify --update --no-viz 2>&1`
        : `cd "${projectDir}" && python3 -m graphify --no-viz 2>&1`;

      const { stdout, stderr } = await execAsync(cmd, { timeout: GRAPHIFY_TIMEOUT });
      const output = (stdout || stderr || "").slice(0, 2000);

      const hasGraph = existsSync(graphJson);
      let nodeCount = 0;
      let edgeCount = 0;

      if (hasGraph) {
        try {
          const graph = JSON.parse(readFileSync(graphJson, "utf-8"));
          nodeCount = graph.nodes?.length ?? 0;
          edgeCount = graph.links?.length ?? 0;
        } catch { /* ignore */ }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `✅ Graph ${isUpdate ? "updated" : "built"} successfully.`,
              "",
              `**Nodes**: ${nodeCount} | **Edges**: ${edgeCount}`,
              `**Output**: ${graphDir}`,
              "",
              output ? `**graphify output:**\n\`\`\`\n${output}\n\`\`\`` : "",
            ].join("\n"),
          },
        ],
        details: { success: true, action: "build", nodeCount, edgeCount, outputPath: graphDir },
      };
    } catch (e: any) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Graph build failed: ${e.message}\n\nTry manually:\n\`cd ${projectDir} && python3 -m graphify\``,
          },
        ],
        details: { success: false, error: e.message },
      };
    }
  }

  private async actionQuery(input: z.infer<typeof this.parameters>, queryAction: string) {
    const { projectDir, target, targetB, mode, budget } = input;

    if (!target) {
      return {
        content: [
          { type: "text" as const, text: `❌ \`target\` is required for ${queryAction}. Provide the module or file name.` },
        ],
        details: { success: false, error: "Missing target" },
      };
    }

    if (queryAction === "trace" && !targetB) {
      return {
        content: [
          { type: "text" as const, text: "❌ Both `target` and `targetB` are required for trace." },
        ],
        details: { success: false, error: "Missing targetB" },
      };
    }

    const graphJson = join(projectDir, "graphify-out", "graph.json");
    if (!existsSync(graphJson)) {
      return {
        content: [
          { type: "text" as const, text: "⚠️ No graph found. Run `build` action first." },
        ],
        details: { success: false, error: "No graph found" },
      };
    }

    const traversal = mode ?? (queryAction === "verify" ? "bfs" : "dfs");
    const tokenBudget = budget ?? (queryAction === "impact" ? 3000 : 2000);

    const args = [
      projectDir,
      queryAction,
      target,
      targetB ?? "",
      traversal,
      String(tokenBudget),
    ].map((a) => `"${a}"`).join(" ");

    try {
      const cmd = `python3 "${SCRIPT_PATH}" ${args} 2>&1`;
      const { stdout } = await execAsync(cmd, { timeout: 30_000 });
      const result = stdout.trim();

      return this.formatQueryResult(queryAction, target, targetB, traversal, tokenBudget, result);
    } catch (e: any) {
      return {
        content: [
          { type: "text" as const, text: `❌ ${queryAction} failed: ${e.message}` },
        ],
        details: { success: false, error: e.message },
      };
    }
  }

  private formatQueryResult(
    queryAction: string,
    target: string,
    targetB: string | undefined,
    traversal: string,
    budget: number,
    result: string,
  ) {
    if (result === "NO_GRAPH") {
      return {
        content: [{ type: "text" as const, text: "⚠️ No graph found. Run `build` action first." }],
        details: { success: false, error: "No graph found" },
      };
    }

    if (result === "NO_MATCH") {
      const msg = queryAction === "trace"
        ? `🔍 No matching nodes found for "${target}" or "${targetB}".`
        : `🔍 No matching nodes found for "${target}".`;
      return {
        content: [{ type: "text" as const, text: msg }],
        details: { success: true, action: queryAction, target, matches: 0 },
      };
    }

    if (result.startsWith("NO_MATCH:")) {
      const missing = result.replace("NO_MATCH:", "");
      return {
        content: [{ type: "text" as const, text: `🔍 No matching node found for "${missing}".` }],
        details: { success: true, action: queryAction, found: false, missing },
      };
    }

    if (result === "NO_PATH") {
      return {
        content: [{ type: "text" as const, text: `🔍 No path found between "${target}" and "${targetB}".` }],
        details: { success: true, action: queryAction, found: false },
      };
    }

    // Parse result
    const lines = result.split("\n");
    const affectedFiles = new Set<string>();
    for (const line of lines) {
      if (line.startsWith("NODE ")) {
        const match = line.match(/src=([^\]]+)/);
        if (match && match[1]) affectedFiles.add(match[1]);
      }
    }

    let header: string;
    let footer: string;

    if (queryAction === "impact") {
      const nodeCount = this.extractNumber(lines, "NODES:");
      const edgeCount = this.extractNumber(lines, "EDGES:");
      header = `📊 **Impact Analysis: "${target}"** (${traversal.toUpperCase()})\n\n**Nodes**: ${nodeCount} | **Edges**: ${edgeCount} | **Files**: ${affectedFiles.size}`;
      footer = "\n**⚠️ Check these files before making changes to prevent missing related modifications.**";
    } else if (queryAction === "trace") {
      const hops = this.extractNumber(lines, "PATH_LENGTH:");
      header = `🔗 **Path: "${target}" → "${targetB}"** (${hops} hops)`;
      footer = "\n**Use this path to trace the dependency chain during debugging.**";
    } else {
      const totalNodes = this.extractNumber(lines, "TOTAL_NODES:");
      header = `✅ **Verification: "${target}"** (BFS)\n\n**Related nodes**: ${totalNodes} | **Files**: ${affectedFiles.size}`;
      footer = "\n**Compare this list against your actual changes. Any node not covered = potential omission.**";
    }

    // Get content after "---" separator
    const sepIdx = lines.indexOf("---");
    const body = sepIdx >= 0 ? lines.slice(sepIdx + 1).join("\n") : result;

    return {
      content: [
        {
          type: "text" as const,
          text: [header, "", "```", body, "```", footer].join("\n"),
        },
      ],
      details: {
        success: true,
        action: queryAction,
        target,
        targetB,
        affectedFiles: [...affectedFiles],
      },
    };
  }

  private extractNumber(lines: string[], prefix: string): number {
    const line = lines.find((l) => l.startsWith(prefix));
    if (!line) return 0;
    return parseInt(line.replace(prefix, "").trim()) || 0;
  }

  private async checkGraphify(): Promise<boolean> {
    try {
      await execAsync('python3 -c "import graphify" 2>/dev/null', { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}
