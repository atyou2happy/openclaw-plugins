import { Type } from "@sinclair/typebox";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface SkillDefinition {
  name: string;
  description: string;
  content: string;
  source: "bundled" | "user" | "plugin";
  path: string;
  keywords: string[];
}

const skillDirs = [
  path.join(process.env.HOME || "~", ".openharness", "skills"),
  path.join(process.env.HOME || "~", ".openclaw", "skills"),
];

async function parseSkillFile(filePath: string): Promise<SkillDefinition | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    let name = path.basename(filePath, ".md");
    let description = "";
    let body = content;
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      body = frontmatterMatch[2];
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (nameMatch) name = nameMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
    }
    if (!description) {
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        name = headingMatch[1].trim();
        const firstPara = body.trim().split("\n\n")[0];
        description = firstPara.slice(0, 150);
      }
    }
    const keywords = [name.toLowerCase(), ...name.toLowerCase().split(/[\s_-]+/)];
    const descWords = description.toLowerCase().split(/\s+/);
    keywords.push(...descWords.filter((w) => w.length > 3));
    return { name, description, content, source: "user", path: filePath, keywords: [...new Set(keywords)] };
  } catch {
    return null;
  }
}

async function discoverSkills(): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = [];
  for (const dir of skillDirs) {
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          const skill = await parseSkillFile(path.join(dir, entry));
          if (skill) skills.push(skill);
        }
      }
    } catch { /* dir doesn't exist */ }
  }
  return skills;
}

function matchSkill(query: string, skills: SkillDefinition[]): SkillDefinition[] {
  const q = query.toLowerCase();
  return skills
    .map((s) => ({
      skill: s,
      score: s.keywords.filter((k) => k.includes(q)).length + (s.name.toLowerCase().includes(q) ? 5 : 0) + (s.description.toLowerCase().includes(q) ? 2 : 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.skill)
    .slice(0, 5);
}

export function registerSkills(api: any) {

    api.registerTool({
      name: "oh_skill_list",
      label: "List Skills",

      parameters: Type.Object({}),
      async execute(_toolCallId: string, _params: any) {
        const skills = await discoverSkills();
        if (skills.length === 0) {
          return { content: [{ type: "text" as const, text: "No skills installed. Add .md files to ~/.openharness/skills/ or ~/.openclaw/skills/" }], details: { success: true } };
        }
        const list = skills.map((s, i) => `${i + 1}. **${s.name}** — ${s.description}\n   Source: ${s.source} | Path: ${s.path}`).join("\n");
        return { content: [{ type: "text" as const, text: `Available Skills (${skills.length}):\n\n${list}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_skill_load",
      label: "Load Skill",

      parameters: Type.Object({
        name: Type.String({ description: "The name of the skill to load" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const skills = await discoverSkills();
        const found = skills.find((s) => s.name.toLowerCase() === params.name.toLowerCase());
        if (!found) {
          const matches = matchSkill(params.name, skills);
          if (matches.length > 0) {
            return { content: [{ type: "text" as const, text: `Skill '${params.name}' not found. Did you mean: ${matches.map((m) => m.name).join(", ")}?` }], details: { success: true } };
          }
          return { content: [{ type: "text" as const, text: `Skill not found: ${params.name}` }], details: { success: true } };
        }
        return { content: [{ type: "text" as const, text: `# ${found.name}\n\n${found.content}` }], details: { success: true } };
      },
    });

    api.registerTool({
      name: "oh_skill_search",
      label: "Search Skills",

      parameters: Type.Object({
        query: Type.String({ description: "Search query to match against skill names, descriptions, and keywords" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const skills = await discoverSkills();
        const matches = matchSkill(params.query, skills);
        if (matches.length === 0) {
          return { content: [{ type: "text" as const, text: `No skills matching '${params.query}'` }], details: { success: true } };
        }
        const list = matches.map((s, i) => `${i + 1}. **${s.name}** — ${s.description}\n   Use oh_skill_load to load the full content`).join("\n");
        return { content: [{ type: "text" as const, text: `Skills matching '${params.query}' (${matches.length}):\n\n${list}` }], details: { success: true } };
      },
    });

    api.on("before_prompt_build", async (event: any, ctx: any) => {
      const query = (event.prompt || "").toLowerCase();
      const skills = await discoverSkills();
      const matches = matchSkill(query, skills);
      if (matches.length > 0) {
        const skillContext = matches.slice(0, 2).map((s) => `---\n## Skill: ${s.name}\n${s.content.slice(0, 1000)}\n---`).join("\n\n");
        event.context = (event.context || "") + "\n\n## Relevant Skills\n" + skillContext;
      }
    });
}
