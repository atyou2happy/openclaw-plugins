import { Type } from "@sinclair/typebox";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

type Language = "python" | "node" | "ruby";

interface ExecuteParams {
  language: Language;
  code: string;
  timeout?: number;
}

interface InstallParams {
  language: Language;
}

const runtimeCommands: Record<Language, { command: string; versionFlag: string }> = {
  python: { command: "python3", versionFlag: "--version" },
  node: { command: "node", versionFlag: "--version" },
  ruby: { command: "ruby", versionFlag: "--version" },
};

const installInstructions: Record<Language, string> = {
  python: `To install Python 3:
- Ubuntu/Debian: sudo apt install python3
- macOS: brew install python3
- Windows: Download from https://www.python.org/downloads/
- Verify: python3 --version`,
  node: `To install Node.js:
- Ubuntu/Debian: sudo apt install nodejs npm
- macOS: brew install node
- Windows: Download from https://nodejs.org/
- Verify: node --version`,
  ruby: `To install Ruby:
- Ubuntu/Debian: sudo apt install ruby
- macOS: brew install ruby
- Windows: Use RubyInstaller from https://rubyinstaller.org/
- Verify: ruby --version`,
};

export function registerRepl(api: any) {

    api.registerTool({
      name: "oh_repl_execute",
      label: "Execute REPL Code",

      parameters: Type.Object({
        language: Type.String({

          enum: ["python", "node", "ruby"],
        }),
        code: Type.String({

        }),
        timeout: Type.Optional(Type.Number({

        })),
      }),
      async execute(_toolCallId: string, params: unknown) {
        const { language, code, timeout = 30 } = params as ExecuteParams;

        if (!runtimeCommands[language]) {
          return {
            content: [{ type: "text" as const, text: `Unsupported language: ${language}. Supported: python, node, ruby` }],
            details: { success: false, error: `Unsupported language: ${language}` },
          };
        }

        const { command } = runtimeCommands[language];

        try {
          const { stdout, stderr } = await execAsync(`${command} -e '${code.replace(/'/g, "'\\''")}'`, {
            timeout: timeout * 1000,
          });

          let result = "";
          if (stdout) {
            result += `stdout:\n${stdout}`;
          }
          if (stderr) {
            result += result ? `\n\nstderr:\n${stderr}` : `stderr:\n${stderr}`;
          }
          if (!result) {
            result = "Code executed successfully (no output)";
          }

          return {
            content: [{ type: "text" as const, text: result }],
            details: { success: true, language, exitCode: 0 },
          };
        } catch (error: unknown) {
          const err = error as { code?: string; stdout?: string; stderr?: string; killed?: boolean; message?: string };
          if (err.code === "ETIMEDOUT" || err.killed) {
            return {
              content: [{ type: "text" as const, text: `Execution timed out after ${timeout}s` }],
              details: { success: false, error: "timeout", language },
            };
          }
          const stderr = err.stderr || err.message;
          return {
            content: [{ type: "text" as const, text: `Error executing ${language} code:\n${stderr}` }],
            details: { success: false, error: stderr, language },
          };
        }
      },
    });

    api.registerTool({
      name: "oh_repl_list_runtimes",
      label: "List REPL Runtimes",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: unknown) {
        const runtimes: Record<string, { available: boolean; version?: string }> = {};

        for (const [lang, { command, versionFlag }] of Object.entries(runtimeCommands)) {
          try {
            const { stdout } = await execAsync(`${command} ${versionFlag}`);
            runtimes[lang] = { available: true, version: stdout.trim() };
          } catch {
            runtimes[lang] = { available: false };
          }
        }

        const available = Object.entries(runtimes)
          .filter(([, v]) => v.available)
          .map(([k, v]) => `${k}: ${v.version}`);

        const unavailable = Object.entries(runtimes)
          .filter(([, v]) => !v.available)
          .map(([k]) => k);

        let text = "Available runtimes:\n";
        if (available.length > 0) {
          text += available.map((a) => `  ✓ ${a}`).join("\n");
        } else {
          text += "  None";
        }
        if (unavailable.length > 0) {
          text += `\n\nNot available:\n  ${unavailable.join(", ")}`;
        }

        return {
          content: [{ type: "text" as const, text }],
          details: { success: true, runtimes },
        };
      },
    });

    api.registerTool({
      name: "oh_repl_install_runtime",
      label: "Install REPL Runtime",

      parameters: Type.Object({
        language: Type.String({

          enum: ["python", "node", "ruby"],
        }),
      }),
      async execute(_toolCallId: string, params: unknown) {
        const { language } = params as InstallParams;
        const instructions = installInstructions[language];

        if (!instructions) {
          return {
            content: [{ type: "text" as const, text: `Unsupported language: ${language}. Supported: python, node, ruby` }],
            details: { success: false, error: `Unsupported language: ${language}` },
          };
        }

        return {
          content: [{ type: "text" as const, text: instructions }],
          details: { success: true, language },
        };
      },
    });
}
