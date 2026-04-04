import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const FileWriteInput = Type.Object({
  file_path: Type.String({ description: "The absolute path to the file to write" }),
  content: Type.String({ description: "The content to write to the file" }),
});
export type FileWriteInput = Static<typeof FileWriteInput>;

export function createFileWriteTool() {
  return {
    name: "oh_file_write",
    label: "Write File",
    description: "Write a file to the local filesystem. Creates parent directories if they don't exist. Overwrites existing files.",
    parameters: FileWriteInput,
    async execute(_toolCallId: string, params: FileWriteInput) {
      const { file_path, content } = params;
      try {
        const dir = path.dirname(file_path);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file_path, content, "utf-8");
        return { content: [{ type: "text" as const, text: `Successfully wrote ${file_path} (${content.length} bytes)` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error writing file: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
