import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const teamsDir = path.join(process.env.HOME || "~", ".openharness", "data", "teams");

const TeamCreateInput = Type.Object({
  name: Type.String({ description: "Team name" }),
  description: Type.Optional(Type.String({ description: "Team description" })),
  agents: Type.Optional(Type.Array(Type.String(), { description: "List of agent IDs to add to the team" })),
});
type TeamCreateInput = Static<typeof TeamCreateInput>;

const TeamDeleteInput = Type.Object({
  name: Type.String({ description: "Team name to delete" }),
});
type TeamDeleteInput = Static<typeof TeamDeleteInput>;

async function ensureTeamsDir() {
  await fs.mkdir(teamsDir, { recursive: true });
}

export function createTeamTools() {
  return [
    {
      name: "oh_team_create",
      label: "Create Team",
      description: "Create a new agent team for multi-agent coordination. Teams group agents for coordinated task execution.",
      parameters: TeamCreateInput,
      async execute(_toolCallId: string, params: TeamCreateInput) {
        const { name, description = "", agents = [] } = params;
        await ensureTeamsDir();
        const team = { name, description, agents, messages: [], created_at: new Date().toISOString() };
        await fs.writeFile(path.join(teamsDir, `${name}.json`), JSON.stringify(team, null, 2));
        return { content: [{ type: "text" as const, text: `Team created: ${name}\nDescription: ${description}\nAgents: ${agents.length}` }], details: { success: true } };
      },
    },
    {
      name: "oh_team_delete",
      label: "Delete Team",
      description: "Delete an agent team.",
      parameters: TeamDeleteInput,
      async execute(_toolCallId: string, params: TeamDeleteInput) {
        const { name } = params;
        try {
          await fs.unlink(path.join(teamsDir, `${name}.json`));
          return { content: [{ type: "text" as const, text: `Team deleted: ${name}` }], details: { success: true } };
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `Team not found: ${name}` }], details: { success: true } };
        }
      },
    },
  ];
}
