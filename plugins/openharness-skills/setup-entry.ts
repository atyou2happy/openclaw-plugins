import { definePluginSetup } from "openclaw/plugin-sdk/setup-entry";

export default definePluginSetup({
  id: "openharness-skills",
  name: "OpenHarness Skills",
  async setup(ctx) {
    // Ensure OpenHarness data directories exist
    const { mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const home = process.env.HOME || "~";
    const dirs = [
      join(home, ".openharness"),
      join(home, ".openharness", "skills"),
      join(home, ".openharness", "data"),
      join(home, ".openharness", "data", "memory"),
      join(home, ".openharness", "data", "tasks"),
      join(home, ".openharness", "data", "teams"),
      join(home, ".openharness", "data", "swarm"),
      join(home, ".openharness", "data", "cron"),
    ];
    for (const dir of dirs) {
      await mkdir(dir, { recursive: true });
    }
  },
});
