import { MessageSyncTool } from "./message-sync-tool.js";
import {
  PromptHistoryListTool,
  PromptHistorySearchTool,
  PromptHistoryGetTool,
  PromptHistoryReuseTool,
} from "./prompt-history-tool.js";
import { AtMentionStatusTool } from "./at-mention-status-tool.js";
import { CodeCopyRenderTool } from "./code-copy-tool.js";
import { QuoteReplyTool } from "./quote-reply-tool.js";
import { ChoiceSelectTool, ChoiceRenderTool } from "./choice-select-tool.js";

export function registerTools(api: any) {
  api.registerTool(new MessageSyncTool());
  api.registerTool(new PromptHistoryListTool());
  api.registerTool(new PromptHistorySearchTool());
  api.registerTool(new PromptHistoryGetTool());
  api.registerTool(new PromptHistoryReuseTool());
  api.registerTool(new AtMentionStatusTool());
  api.registerTool(new CodeCopyRenderTool());
  api.registerTool(new QuoteReplyTool());
  api.registerTool(new ChoiceSelectTool());
  api.registerTool(new ChoiceRenderTool());
}
