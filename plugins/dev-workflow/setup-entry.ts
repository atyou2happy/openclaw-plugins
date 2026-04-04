import { defineSetupPluginEntry } from "openclaw/plugin-sdk/core";
import { devWorkflowChannel } from "./src/channel/dev-workflow-channel.js";

export default defineSetupPluginEntry(devWorkflowChannel);
