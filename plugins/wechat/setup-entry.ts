import { defineSetupPluginEntry } from "openclaw/plugin-sdk/core";
import { wechatPlugin } from "./src/channel.js";

export default defineSetupPluginEntry(wechatPlugin);
