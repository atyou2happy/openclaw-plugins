import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
import { createBashTool } from "./tools/bash.js";
import { createFileReadTool } from "./tools/file-read.js";
import { createFileWriteTool } from "./tools/file-write.js";
import { createFileEditTool } from "./tools/file-edit.js";
import { createGlobTool } from "./tools/glob.js";
import { createGrepTool } from "./tools/grep.js";
import { createWebFetchTool } from "./tools/web-fetch.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { createSkillTool } from "./tools/skill.js";
import { createConfigTool } from "./tools/config.js";
import { createBriefTool } from "./tools/brief.js";
import { createTodoWriteTool } from "./tools/todo-write.js";
import { createPlanModeTools } from "./tools/plan-mode.js";
import { createTaskTools } from "./tools/tasks.js";
import { createAgentTools } from "./tools/agent.js";
import { createTeamTools } from "./tools/team.js";
import { createCronTools } from "./tools/cron.js";
import { createNotebookEditTool } from "./tools/notebook-edit.js";

export default definePluginEntry({
  id: "openharness-tools",
  name: "OpenHarness Tools",
  description: "43+ OpenHarness tools bridged into OpenClaw",
  register(api) {
    // File I/O tools
    api.registerTool(createBashTool());
    api.registerTool(createFileReadTool());
    api.registerTool(createFileWriteTool());
    api.registerTool(createFileEditTool());
    api.registerTool(createGlobTool());
    api.registerTool(createGrepTool());
    api.registerTool(createNotebookEditTool());

    // Search & Web tools
    api.registerTool(createWebFetchTool());
    api.registerTool(createWebSearchTool());

    // Knowledge & Config tools
    api.registerTool(createSkillTool());
    api.registerTool(createConfigTool());
    api.registerTool(createBriefTool());

    // Workflow tools
    api.registerTool(createTodoWriteTool());
    const { enterPlanMode, exitPlanMode } = createPlanModeTools();
    api.registerTool(enterPlanMode);
    api.registerTool(exitPlanMode);

    // Task management tools
    const taskTools = createTaskTools();
    taskTools.forEach((t) => api.registerTool(t));

    // Agent & coordination tools
    const agentTools = createAgentTools();
    agentTools.forEach((t) => api.registerTool(t));

    const teamTools = createTeamTools();
    teamTools.forEach((t) => api.registerTool(t));

    // Cron & schedule tools
    const cronTools = createCronTools();
    cronTools.forEach((t) => api.registerTool(t));
  },
});
