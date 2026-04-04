import { Type, type Static } from "@sinclair/typebox";
import { glob } from "node:fs/promises";

export const GlobInput = Type.Object({
  pattern: Type.String({ description: "The glob pattern to match files against (e.g., '**/*.ts')" }),
  path: Type.Optional(Type.String({ description: "The directory to search in. Defaults to current working directory." })),
});
export type GlobInput = Static<typeof GlobInput>;

export function createGlobTool() {
  return {
    name: "oh_glob",
    label: "Glob File Patterns",
    description: "Fast file pattern matching tool that works with any codebase size. Supports glob patterns like '**/*.js' or 'src/**/*.ts'.",
    parameters: GlobInput,
    async execute(_toolCallId: string, params: GlobInput) {
      const { pattern, path } = params;
      try {
        const searchPath = path || process.cwd();
        const matches: string[] = [];
        for await (const entry of glob(pattern, { cwd: searchPath, withFileTypes: false })) {
          matches.push(entry as string);
        }
        if (matches.length === 0) {
          return { content: [{ type: "text" as const, text: `No files matched pattern '${pattern}' in ${searchPath}` }], details: { success: true } };
        }
        return { content: [{ type: "text" as const, text: matches.slice(0, 100).join("\n") + (matches.length > 100 ? `\n\n... and ${matches.length - 100} more` : "") }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
