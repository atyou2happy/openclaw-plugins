import { Type, type Static } from "@sinclair/typebox";

const ConfigInput = Type.Object({
  key: Type.Optional(Type.String({ description: "Configuration key to get/set" })),
  value: Type.Optional(Type.String({ description: "Value to set for the key" })),
  action: Type.String({ description: "Action: get, set, list", enum: ["get", "set", "list"] }),
});
type ConfigInput = Static<typeof ConfigInput>;

export function createConfigTool() {
  return {
    name: "oh_config",
    label: "Manage Config",
    description: "Get, set, or list OpenHarness configuration settings. Use 'list' to see all current settings, 'get' to read a specific key, 'set' to update a value.",
    parameters: ConfigInput,
    async execute(_toolCallId: string, params: ConfigInput) {
      const { key, value, action } = params;
      const configFile = `${process.env.HOME}/.openharness/settings.json`;
      try {
        const { default: fs } = await import("node:fs/promises");
        let config: Record<string, any> = {};
        try {
          config = JSON.parse(await fs.readFile(configFile, "utf-8"));
        } catch { /* file doesn't exist */ }

        if (action === "list") {
          return { content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }], details: { success: true } };
        }
        if (action === "get" && key) {
          const val = key.split(".").reduce((obj: any, k) => obj?.[k], config);
          return { content: [{ type: "text" as const, text: val !== undefined ? JSON.stringify(val, null, 2) : `Key '${key}' not found` }], details: { success: true } };
        }
        if (action === "set" && key && value) {
          const keys = key.split(".");
          let obj = config;
          for (let i = 0; i < keys.length - 1; i++) {
            obj[keys[i]] = obj[keys[i]] || {};
            obj = obj[keys[i]];
          }
          obj[keys[keys.length - 1]] = value;
          await fs.writeFile(configFile, JSON.stringify(config, null, 2));
          return { content: [{ type: "text" as const, text: `Set ${key} = ${value}` }], details: { success: true } };
        }
        return { content: [{ type: "text" as const, text: "Usage: action=get/set/list, key=<path>, value=<value>" }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
