import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const TodoWriteInput = Type.Object({
  todos: Type.Array(
    Type.Object({
      content: Type.String({ description: "Brief description of the task" }),
      status: Type.String({ description: "Current status: pending, in_progress, completed, cancelled", enum: ["pending", "in_progress", "completed", "cancelled"] }),
      priority: Type.String({ description: "Priority level: high, medium, low", enum: ["high", "medium", "low"] }),
    }),
    { description: "The updated todo list (replaces all existing todos)" },
  ),
});
type TodoWriteInput = Static<typeof TodoWriteInput>;

const todoFile = path.join(process.cwd(), ".openharness-todos.json");

export function createTodoWriteTool() {
  return {
    name: "oh_todo_write",
    label: "Manage Todos",
    description: "Create and manage a structured task list. Use for tracking progress on complex multi-step tasks. Replaces the entire todo list with the new state.",
    parameters: TodoWriteInput,
    async execute(_toolCallId: string, params: TodoWriteInput) {
      const { todos } = params;
      try {
        await fs.writeFile(todoFile, JSON.stringify(todos, null, 2));
        const summary = todos.map((t, i) => `${i + 1}. [${t.status}] ${t.content} (${t.priority})`).join("\n");
        return { content: [{ type: "text" as const, text: `Todo list updated (${todos.length} tasks):\n${summary}` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error updating todos: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
