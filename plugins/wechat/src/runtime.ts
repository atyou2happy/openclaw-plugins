import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "./runtime-api.js";

const { setRuntime: setWeChatRuntime, getRuntime: getWeChatRuntime } =
  createPluginRuntimeStore<PluginRuntime>("WeChat runtime not initialized");

export { getWeChatRuntime, setWeChatRuntime };
