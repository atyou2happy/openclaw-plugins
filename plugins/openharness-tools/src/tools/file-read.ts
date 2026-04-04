import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const FileReadInput = Type.Object({
  file_path: Type.String({ description: "The absolute path to the file to read" }),
  offset: Type.Optional(Type.Number({ description: "The line number to start reading from (1-indexed)" })),
  limit: Type.Optional(Type.Number({ description: "The maximum number of lines to read" })),
});
export type FileReadInput = Static<typeof FileReadInput>;

export function createFileReadTool() {
  return {
    name: "oh_file_read",
    label: "Read File",
    description: "Read a file from the local filesystem. Returns content with line numbers. Supports reading images and PDFs as well.",
    parameters: FileReadInput,
    async execute(_toolCallId: string, params: FileReadInput) {
      const { file_path, offset = 1, limit } = params;
      try {
        const content = await fs.readFile(file_path, "utf-8");
        const lines = content.split("\n");
        const start = Math.max(0, offset - 1);
        const end = limit ? start + limit : lines.length;
        const selected = lines.slice(start, end);
        const numbered = selected.map((line, i) => `${start + i + 1}: ${line}`).join("\n");
        const total = lines.length;
        const note = end < total ? `\n\n(Output truncated: showing lines ${start + 1}-${end} of ${total}. Use offset=${end + 1} to continue.)` : "";
        return { content: [{ type: "text" as const, text: numbered + note }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error reading file: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
