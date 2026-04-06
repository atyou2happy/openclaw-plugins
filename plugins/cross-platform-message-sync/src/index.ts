import { registerTools } from "./tools/index.js";
import { registerHooks } from "./hooks/index.js";

/**
 * OpenClaw plugin entry point.
 *
 * NOTE: Do NOT wrap with `definePluginEntry()` — the Gateway uses jiti
 * to load plugins and expects a named `register` (or `activate`) export.
 * `export default definePluginEntry(...)` results in:
 *   "missing register/activate export"
 */
export function register(api) {
  api.logger?.info?.("[cross-platform-message-sync] registering tools and hooks");
  registerTools(api);
  registerHooks(api);
}
