import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";

export const FileEditInput = Type.Object({
  file_path: Type.String({ description: "The absolute path to the file to modify" }),
  old_string: Type.String({ description: "The text to replace (must match exactly, including whitespace)" }),
  new_string: Type.String({ description: "The text to replace it with" }),
  replace_all: Type.Optional(Type.Boolean({ description: "Replace all occurrences instead of just the first" })),
});
export type FileEditInput = Static<typeof FileEditInput>;

export function createFileEditTool() {
  return {
    name: "oh_file_edit",
    label: "Edit File",
    description: "Perform exact string replacement in a file. Use for targeted edits without rewriting the entire file. Supports replace_all for renaming variables.",
    parameters: FileEditInput,
    async execute(_toolCallId: string, params: FileEditInput) {
      const { file_path, old_string, new_string, replace_all = false } = params;
      try {
        const content = await fs.readFile(file_path, "utf-8");
        if (replace_all) {
          const count = content.split(old_string).length - 1;
          if (count === 0) {
            return { content: [{ type: "text" as const, text: `Error: old_string not found in ${file_path}` }], details: { success: true } };
          }
          const updated = content.split(old_string).join(new_string);
          await fs.writeFile(file_path, updated, "utf-8");
          return { content: [{ type: "text" as const, text: `Replaced ${count} occurrences in ${file_path}` }], details: { success: true } };
        }
        const index = content.indexOf(old_string);
        if (index === -1) {
          return { content: [{ type: "text" as const, text: `Error: old_string not found in ${file_path}` }], details: { success: true } };
        }
        const updated = content.slice(0, index) + new_string + content.slice(index + old_string.length);
        await fs.writeFile(file_path, updated, "utf-8");
        return { content: [{ type: "text" as const, text: `Successfully edited ${file_path}` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error editing file: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
