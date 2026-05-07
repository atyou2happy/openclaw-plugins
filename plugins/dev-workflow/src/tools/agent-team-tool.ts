import type { AnyAgentTool, ToolCall } from "openclaw/plugin-sdk/core";
import { getEngine } from "../channel/runtime.js";

export class AgentTeamTool implements AnyAgentTool {
  name = "agent_team_status";
  description = "View the current Agent Team execution status, file ownership, contracts, and sync history. Use when you need to check parallel task execution progress.";
  
  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string" as const,
        enum: ["status", "ownership", "contracts", "sync-history"],
        description: "What to query: status (overall team state), ownership (file assignments), contracts (published interfaces), sync-history (sync point results)"
      }
    },
    required: ["action"] as const
  };

  async execute(_toolCallId: string, args: { action: string }): Promise<ToolCall.Result> {
    let engine;
    try {
      engine = getEngine();
    } catch {
      return { content: [{ type: "text", text: "Agent Team: Engine not initialized." }] };
    }
    
    const context = engine.getContext();
    if (!context?.teamState) {
      return { content: [{ type: "text", text: "Agent Team: No team state available. Agent Team may not be enabled or hasn't started yet." }] };
    }

    const teamState = context.teamState;
    let output = "";

    switch (args.action) {
      case "status":
        output = [
          `Agent Team Status:`,
          `  Current Batch: ${teamState.currentBatchIndex}`,
          `  Active Agents: ${teamState.activeAgents.length}`,
          `  Published Contracts: ${teamState.publishedContracts.length}`,
          `  Sync Points Executed: ${teamState.syncHistory.length}`,
          `  Fallback Used: ${teamState.fallbackUsed}`,
          ``,
          `Active Agents Detail:`,
          ...teamState.activeAgents.map((a: any) => 
            `  ${a.id}: task=${a.assignedTaskId}, files=[${a.ownedFiles.join(", ")}], status=${a.status}`
          )
        ].join("\n");
        break;

      case "ownership":
        const ownership = teamState.fileOwnership;
        output = [
          `File Ownership:`,
          `  Allocations:`,
          ...Object.entries(ownership.allocations).map(([agent, files]: [string, any]) =>
            `    ${agent}: [${files.join(", ")}]`
          ),
          ``,
          `  Ownership Map:`,
          ...Object.entries(ownership.ownership).map(([file, agent]: [string, any]) =>
            `    ${file} → ${agent}`
          )
        ].join("\n");
        break;

      case "contracts":
        output = [
          `Published Contracts (${teamState.publishedContracts.length}):`,
          ...teamState.publishedContracts.map((c: any) =>
            `  [${c.type}] ${c.name} (from task ${c.taskId}) @ ${c.filePath}`
          )
        ].join("\n");
        break;

      case "sync-history":
        output = [
          `Sync History (${teamState.syncHistory.length} points):`,
          ...teamState.syncHistory.map((s: any) => [
            `  Sync "${s.syncPoint}": ${s.passed ? "PASSED" : "FAILED"}`,
            ...s.actions.map((a: any) => `    ${a.type}: ${a.passed ? "OK" : "FAIL"} — ${a.output.slice(0, 100)}`),
            ...(s.conflicts.length > 0 ? s.conflicts.map((c: any) => `    CONFLICT: ${c.file} (${c.agentIds.join(", ")}) → ${c.resolution}`) : [])
          ].join("\n"))
        ].join("\n");
        break;

      default:
        output = `Unknown action: ${args.action}. Use: status, ownership, contracts, sync-history`;
    }

    return { content: [{ type: "text", text: output }] };
  }
}
