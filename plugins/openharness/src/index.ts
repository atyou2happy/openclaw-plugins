import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerTools } from "./tools/index.js";
import { registerAuth } from "./auth/index.js";
import { registerBridge } from "./bridge/index.js";
import { registerCodeIntel } from "./code-intel/index.js";
import { registerCommands } from "./commands/index.js";
import { registerContext } from "./context/index.js";
import { registerCost } from "./cost/index.js";
import { registerGitflow } from "./gitflow/index.js";
import { registerGithub } from "./github/index.js";
import { registerGovernance } from "./governance/index.js";
import { registerInteractive } from "./interactive/index.js";
import { registerLsp } from "./lsp/index.js";
import { registerMcp } from "./mcp/index.js";
import { registerMemory } from "./memory/index.js";
import { registerProvider } from "./provider/index.js";
import { registerRepl } from "./repl/index.js";
import { registerSession } from "./session/index.js";
import { registerSessionOps } from "./session-ops/index.js";
import { registerSkills } from "./skills/index.js";
import { registerStructuredOutput } from "./structured-output/index.js";
import { registerSwarm } from "./swarm/index.js";

export { registerTools } from "./tools/index.js";
export { registerAuth } from "./auth/index.js";
export { registerBridge } from "./bridge/index.js";
export { registerCodeIntel } from "./code-intel/index.js";
export { registerCommands } from "./commands/index.js";
export { registerContext } from "./context/index.js";
export { registerCost } from "./cost/index.js";
export { registerGitflow } from "./gitflow/index.js";
export { registerGithub } from "./github/index.js";
export { registerGovernance } from "./governance/index.js";
export { registerInteractive } from "./interactive/index.js";
export { registerLsp } from "./lsp/index.js";
export { registerMcp } from "./mcp/index.js";
export { registerMemory } from "./memory/index.js";
export { registerProvider } from "./provider/index.js";
export { registerRepl } from "./repl/index.js";
export { registerSession } from "./session/index.js";
export { registerSessionOps } from "./session-ops/index.js";
export { registerSkills } from "./skills/index.js";
export { registerStructuredOutput } from "./structured-output/index.js";
export { registerSwarm } from "./swarm/index.js";

export default definePluginEntry({
  id: "openharness",
  name: "OpenHarness",
  description: "Unified OpenHarness plugin — 140+ tools, 19 commands, 5 hooks merged into a single OpenClaw plugin",
  register(api) {
    const regs = [
      ["tools", () => registerTools(api)],
      ["auth", () => registerAuth(api)],
      ["bridge", () => registerBridge(api)],
      ["code-intel", () => registerCodeIntel(api)],
      ["commands", () => registerCommands(api)],
      ["context", () => registerContext(api)],
      ["cost", () => registerCost(api)],
      ["gitflow", () => registerGitflow(api)],
      ["github", () => registerGithub(api)],
      ["governance", () => registerGovernance(api)],
      ["interactive", () => registerInteractive(api)],
      ["lsp", () => registerLsp(api)],
      ["mcp", () => registerMcp(api)],
      ["memory", () => registerMemory(api)],
      ["provider", () => registerProvider(api)],
      ["repl", () => registerRepl(api)],
      ["session", () => registerSession(api)],
      ["session-ops", () => registerSessionOps(api)],
      ["skills", () => registerSkills(api)],
      ["structured-output", () => registerStructuredOutput(api)],
      ["swarm", () => registerSwarm(api)],
    ];
    for (const [name, fn] of regs as [string, () => void][]) {
      try { fn(); } catch(e: any) { console.error(`[openharness] register FAILED: ${name}:`, e.message, e.stack); }
    }
  },
});
