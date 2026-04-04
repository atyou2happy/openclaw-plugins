import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";

const NotebookEditInput = Type.Object({
  file_path: Type.String({ description: "Path to the Jupyter notebook file (.ipynb)" }),
  cell_index: Type.Number({ description: "Index of the cell to edit (0-based)" }),
  source: Type.String({ description: "New source content for the cell" }),
  cell_type: Type.Optional(Type.String({ description: "Cell type: code or markdown", enum: ["code", "markdown"] })),
});
type NotebookEditInput = Static<typeof NotebookEditInput>;

export function createNotebookEditTool() {
  return {
    name: "oh_notebook_edit",
    label: "Edit Notebook Cell",
    description: "Edit a cell in a Jupyter notebook (.ipynb file). Use for updating code or markdown cells.",
    parameters: NotebookEditInput,
    async execute(_toolCallId: string, params: NotebookEditInput) {
      const { file_path, cell_index, source, cell_type } = params;
      try {
        const content = await fs.readFile(file_path, "utf-8");
        const notebook = JSON.parse(content);
        if (cell_index < 0 || cell_index >= notebook.cells.length) {
          return { content: [{ type: "text" as const, text: `Error: cell_index ${cell_index} out of range (0-${notebook.cells.length - 1})` }], details: { success: true } };
        }
        const cell = notebook.cells[cell_index];
        if (cell_type) cell.cell_type = cell_type;
        cell.source = source.split("\n").map((line: string, i: number, arr: string[]) => i < arr.length - 1 ? line + "\n" : line);
        await fs.writeFile(file_path, JSON.stringify(notebook, null, 1));
        return { content: [{ type: "text" as const, text: `Updated cell ${cell_index} in ${file_path}` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error editing notebook: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
