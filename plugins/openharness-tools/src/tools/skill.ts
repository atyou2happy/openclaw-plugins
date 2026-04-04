import { Type, type Static } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const SkillInput = Type.Object({
  name: Type.String({ description: "The name of the skill to load or search for" }),
  query: Type.Optional(Type.String({ description: "Search query within skills" })),
});
type SkillInput = Static<typeof SkillInput>;

const skillsDir = path.join(process.env.HOME || "~", ".openharness", "skills");

export function createSkillTool() {
  return {
    name: "oh_skill",
    label: "Load Skill",
    description: "Load, list, or search for available skills. Skills are markdown files with domain-specific knowledge that can be injected into the agent's context.",
    parameters: SkillInput,
    async execute(_toolCallId: string, params: SkillInput) {
      const { name, query } = params;
      try {
        if (name) {
          const skillPath = path.join(skillsDir, `${name}.md`);
          const content = await fs.readFile(skillPath, "utf-8");
          return { content: [{ type: "text" as const, text: content }], details: { success: true } };
        }
        if (query) {
          const entries = await fs.readdir(skillsDir);
          const matches = entries.filter((f) => f.endsWith(".md") && f.toLowerCase().includes(query.toLowerCase()));
          return { content: [{ type: "text" as const, text: matches.length ? matches.join("\n") : `No skills matching '${query}'` }], details: { success: true } };
        }
        const entries = await fs.readdir(skillsDir);
        const skills = entries.filter((f) => f.endsWith(".md"));
        return { content: [{ type: "text" as const, text: skills.length ? `Available skills:\n${skills.join("\n")}` : "No skills installed" }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
