import { Type, type Static } from "@sinclair/typebox";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const GrepInput = Type.Object({
  pattern: Type.String({ description: "The regex pattern to search for in file contents" }),
  path: Type.Optional(Type.String({ description: "The directory to search in. Defaults to current working directory." })),
  include: Type.Optional(Type.String({ description: "File pattern to include in the search (e.g., '*.ts', '*.{ts,tsx}')" })),
});
export type GrepInput = Static<typeof GrepInput>;

export function createGrepTool() {
  return {
    name: "oh_grep",
    label: "Grep File Contents",
    description: "Fast content search tool that works with any codebase size. Searches file contents using regular expressions. Returns file paths and line numbers with matches.",
    parameters: GrepInput,
    async execute(_toolCallId: string, params: GrepInput) {
      const { pattern, path, include } = params;
      try {
        const searchPath = path || process.cwd();
        const includeFlag = include ? `--include='${include}'` : "";
        const { stdout } = await execAsync(`grep -rn '${pattern}' ${includeFlag} . 2>/dev/null || true`, {
          cwd: searchPath,
          maxBuffer: 10 * 1024 * 1024,
        });
        if (!stdout.trim()) {
          return { content: [{ type: "text" as const, text: `No matches found for pattern '${pattern}' in ${searchPath}` }], details: { success: true } };
        }
        const lines = stdout.trim().split("\n").slice(0, 100);
        const truncated = stdout.trim().split("\n").length > 100 ? `\n\n... and more matches` : "";
        return { content: [{ type: "text" as const, text: lines.join("\n") + truncated }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
