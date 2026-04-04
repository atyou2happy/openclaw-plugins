import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const cronDir = path.join(process.env.HOME || "~", ".openharness", "data", "cron");

const CronCreateInput = Type.Object({
  schedule: Type.String({ description: "Cron expression (e.g., '0 9 * * *' for daily at 9am)" }),
  command: Type.String({ description: "Command or prompt to execute on schedule" }),
  label: Type.Optional(Type.String({ description: "Label for this cron job" })),
});
type CronCreateInput = Static<typeof CronCreateInput>;

const CronDeleteInput = Type.Object({
  id: Type.String({ description: "Cron job ID to delete" }),
});
type CronDeleteInput = Static<typeof CronDeleteInput>;

const RemoteTriggerInput = Type.Object({
  url: Type.String({ description: "URL to trigger" }),
  method: Type.Optional(Type.String({ description: "HTTP method", enum: ["GET", "POST", "PUT", "DELETE"] })),
  body: Type.Optional(Type.String({ description: "Request body for POST/PUT" })),
});
type RemoteTriggerInput = Static<typeof RemoteTriggerInput>;

async function ensureCronDir() {
  await fs.mkdir(cronDir, { recursive: true });
}

export function createCronTools() {
  return [
    {
      name: "oh_cron_create",
      label: "Create Cron Job",
      description: "Create a scheduled task using a cron expression. The task will run the specified command/prompt on the given schedule.",
      parameters: CronCreateInput,
      async execute(_toolCallId: string, params: CronCreateInput) {
        const { schedule, command, label = "cron" } = params;
        await ensureCronDir();
        const id = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const job = { id, schedule, command, label, active: true, created_at: new Date().toISOString() };
        await fs.writeFile(path.join(cronDir, `${id}.json`), JSON.stringify(job, null, 2));
        return { content: [{ type: "text" as const, text: `Cron job created: ${id}\nSchedule: ${schedule}\nCommand: ${command.slice(0, 100)}\nLabel: ${label}` }], details: { success: true } };
      },
    },
    {
      name: "oh_cron_list",
      label: "List Cron Jobs",
      description: "List all scheduled cron jobs.",
      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        try {
          await ensureCronDir();
          const entries = await fs.readdir(cronDir);
          const jobs: any[] = [];
          for (const entry of entries) {
            if (entry.endsWith(".json")) {
              const content = await fs.readFile(path.join(cronDir, entry), "utf-8");
              jobs.push(JSON.parse(content));
            }
          }
          if (jobs.length === 0) {
            return { content: [{ type: "text" as const, text: "No scheduled cron jobs" }], details: { success: true } };
          }
          const summary = jobs.map((j) => `[${j.active ? "active" : "inactive"}] ${j.id}: ${j.schedule} - ${j.label}`).join("\n");
          return { content: [{ type: "text" as const, text: `Cron jobs:\n${summary}` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], details: { success: true } };
        }
      },
    },
    {
      name: "oh_cron_delete",
      label: "Delete Cron Job",
      description: "Delete a scheduled cron job.",
      parameters: CronDeleteInput,
      async execute(_toolCallId: string, params: CronDeleteInput) {
        const { id } = params;
        try {
          await fs.unlink(path.join(cronDir, `${id}.json`));
          return { content: [{ type: "text" as const, text: `Cron job deleted: ${id}` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Cron job not found: ${id}` }], details: { success: true } };
        }
      },
    },
    {
      name: "oh_remote_trigger",
      label: "Remote Trigger",
      description: "Trigger a remote execution by making an HTTP request to a specified URL.",
      parameters: RemoteTriggerInput,
      async execute(_toolCallId: string, params: RemoteTriggerInput) {
        const { url, method = "GET", body } = params;
        try {
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body || undefined,
          });
          const text = await response.text();
          return { content: [{ type: "text" as const, text: `HTTP ${response.status} from ${url}:\n${text.slice(0, 2000)}` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Error triggering ${url}: ${err.message}` }], details: { success: true } };
        }
      },
    },
  ];
}
