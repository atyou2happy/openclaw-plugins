import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const tasksDir = path.join(process.env.HOME || "~", ".openharness", "data", "tasks");

const TaskCreateInput = Type.Object({
  title: Type.String({ description: "Task title" }),
  description: Type.Optional(Type.String({ description: "Task description" })),
  mode: Type.Optional(Type.String({ description: "Agent mode: local_agent, remote_agent, in_process_teammate", enum: ["local_agent", "remote_agent", "in_process_teammate"] })),
});
type TaskCreateInput = Static<typeof TaskCreateInput>;

const TaskGetInput = Type.Object({
  task_id: Type.String({ description: "The task ID to retrieve" }),
});
type TaskGetInput = Static<typeof TaskGetInput>;

const TaskListInput = Type.Object({
  status: Type.Optional(Type.String({ description: "Filter by status: running, completed, failed, stopped", enum: ["running", "completed", "failed", "stopped"] })),
});
type TaskListInput = Static<typeof TaskListInput>;

const TaskStopInput = Type.Object({
  task_id: Type.String({ description: "The task ID to stop" }),
});
type TaskStopInput = Static<typeof TaskStopInput>;

const TaskOutputInput = Type.Object({
  task_id: Type.String({ description: "The task ID to get output for" }),
  limit: Type.Optional(Type.Number({ description: "Maximum lines to return" })),
});
type TaskOutputInput = Static<typeof TaskOutputInput>;

const TaskUpdateInput = Type.Object({
  task_id: Type.String({ description: "The task ID to update" }),
  status: Type.Optional(Type.String({ description: "New status", enum: ["running", "completed", "failed", "stopped"] })),
  description: Type.Optional(Type.String({ description: "Updated description" })),
});
type TaskUpdateInput = Static<typeof TaskUpdateInput>;

async function ensureTasksDir() {
  await fs.mkdir(tasksDir, { recursive: true });
}

async function listTasks(): Promise<Record<string, any>[]> {
  try {
    await ensureTasksDir();
    const entries = await fs.readdir(tasksDir);
    const tasks: Record<string, any>[] = [];
    for (const entry of entries) {
      if (entry.endsWith(".json")) {
        const content = await fs.readFile(path.join(tasksDir, entry), "utf-8");
        tasks.push(JSON.parse(content));
      }
    }
    return tasks;
  } catch {
    return [];
  }
}

export function createTaskTools() {
  return [
    {
      name: "oh_task_create",
      label: "Create Task",
      description: "Create a new background task. Tasks run asynchronously and can be monitored via oh_task_list and oh_task_output.",
      parameters: TaskCreateInput,
      async execute(_toolCallId: string, params: TaskCreateInput) {
        const { title, description = "", mode = "local_agent" } = params;
        await ensureTasksDir();
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const task = { id: taskId, title, description, mode, status: "running", created_at: new Date().toISOString(), output: "" };
        await fs.writeFile(path.join(tasksDir, `${taskId}.json`), JSON.stringify(task, null, 2));
        return { content: [{ type: "text" as const, text: `Task created: ${taskId}\nTitle: ${title}\nMode: ${mode}\nStatus: running` }], details: { success: true } };
      },
    },
    {
      name: "oh_task_get",
      label: "Get Task",
      description: "Get details of a specific background task by ID.",
      parameters: TaskGetInput,
      async execute(_toolCallId: string, params: TaskGetInput) {
        const { task_id } = params;
        try {
          const content = await fs.readFile(path.join(tasksDir, `${task_id}.json`), "utf-8");
          return { content: [{ type: "text" as const, text: JSON.stringify(JSON.parse(content), null, 2) }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Task not found: ${task_id}` }], details: { success: true } };
        }
      },
    },
    {
      name: "oh_task_list",
      label: "List Tasks",
      description: "List all background tasks with their status.",
      parameters: TaskListInput,
      async execute(_toolCallId: string, params: TaskListInput) {
        const tasks = await listTasks();
        const filtered = params.status ? tasks.filter((t) => t.status === params.status) : tasks;
        if (filtered.length === 0) {
          return { content: [{ type: "text" as const, text: "No background tasks found" }], details: { success: true } };
        }
        const summary = filtered.map((t) => `[${t.status}] ${t.id}: ${t.title}`).join("\n");
        return { content: [{ type: "text" as const, text: `Background tasks:\n${summary}` }], details: { success: true } };
      },
    },
    {
      name: "oh_task_stop",
      label: "Stop Task",
      description: "Stop a running background task.",
      parameters: TaskStopInput,
      async execute(_toolCallId: string, params: TaskStopInput) {
        const { task_id } = params;
        try {
          const taskPath = path.join(tasksDir, `${task_id}.json`);
          const task = JSON.parse(await fs.readFile(taskPath, "utf-8"));
          task.status = "stopped";
          await fs.writeFile(taskPath, JSON.stringify(task, null, 2));
          return { content: [{ type: "text" as const, text: `Task ${task_id} stopped` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Task not found: ${task_id}` }], details: { success: true } };
        }
      },
    },
    {
      name: "oh_task_output",
      label: "Get Task Output",
      description: "Get the output of a background task.",
      parameters: TaskOutputInput,
      async execute(_toolCallId: string, params: TaskOutputInput) {
        const { task_id, limit } = params;
        try {
          const taskPath = path.join(tasksDir, `${task_id}.json`);
          const task = JSON.parse(await fs.readFile(taskPath, "utf-8"));
          let output = task.output || "(no output yet)";
          if (limit) {
            output = output.split("\n").slice(-limit).join("\n");
          }
          return { content: [{ type: "text" as const, text: `Task ${task_id} output:\n${output}` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Task not found: ${task_id}` }], details: { success: true } };
        }
      },
    },
    {
      name: "oh_task_update",
      label: "Update Task",
      description: "Update a background task's status or description.",
      parameters: TaskUpdateInput,
      async execute(_toolCallId: string, params: TaskUpdateInput) {
        const { task_id, status, description } = params;
        try {
          const taskPath = path.join(tasksDir, `${task_id}.json`);
          const task = JSON.parse(await fs.readFile(taskPath, "utf-8"));
          if (status) task.status = status;
          if (description) task.description = description;
          await fs.writeFile(taskPath, JSON.stringify(task, null, 2));
          return { content: [{ type: "text" as const, text: `Task ${task_id} updated` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Task not found: ${task_id}` }], details: { success: true } };
        }
      },
    },
  ];
}
