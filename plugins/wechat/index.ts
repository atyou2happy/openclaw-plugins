import type { ChannelPlugin } from "openclaw/plugin-sdk/core";
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/core";
import { wechatPlugin } from "./src/channel.js";
import { setWeChatRuntime } from "./src/runtime.js";

export { wechatPlugin } from "./src/channel.js";
export { setWeChatRuntime } from "./src/runtime.js";

export default defineChannelPluginEntry({
  id: "wechat",
  name: "WeChat",
  description: "WeChat Official Account and WeCom (企业微信) channel plugin",
  plugin: wechatPlugin as ChannelPlugin,
  setRuntime: setWeChatRuntime,
});
