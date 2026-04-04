import { Type, type Static } from "@sinclair/typebox";

export const BashInput = Type.Object({
  command: Type.String({ description: "The bash command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds (default: 120000)" })),
  workdir: Type.Optional(Type.String({ description: "Working directory for the command" })),
});
export type BashInput = Static<typeof BashInput>;

export function createBashTool() {
  return {
    name: "oh_bash",
    label: "Execute Bash Command",
    description: "Execute a bash command in a persistent shell session with optional timeout. Use for git, npm, python, docker, and other CLI operations.",
    parameters: BashInput,
    async execute(_toolCallId: string, params: BashInput) {
      const { command, timeout = 120000, workdir } = params;
      try {
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);
        const { stdout, stderr } = await execAsync(command, {
          timeout,
          cwd: workdir || process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
        });
        const output = stderr ? `${stdout}\n[stderr]\n${stderr}` : stdout;
        return { content: [{ type: "text" as const, text: output || "(command completed with no output)" }], details: { success: true } };
      } catch (err: any) {
        const output = err.stdout || "";
        const error = err.stderr || err.message || "";
        const text = output
          ? `${output}\n[error]\n${error}`
          : `Command failed: ${error}`;
        return { content: [{ type: "text" as const, text }], details: { success: true } };
      }
    },
  };
}
