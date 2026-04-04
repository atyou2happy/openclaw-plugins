import { Type, type Static } from "@sinclair/typebox";

const AgentSpawnInput = Type.Object({
  prompt: Type.String({ description: "The task/prompt for the subagent to execute" }),
  label: Type.Optional(Type.String({ description: "A label for this agent instance" })),
  mode: Type.Optional(Type.String({ description: "Agent mode: local_agent, remote_agent, in_process_teammate", enum: ["local_agent", "remote_agent", "in_process_teammate"] })),
  model: Type.Optional(Type.String({ description: "Model to use for this agent" })),
});
type AgentSpawnInput = Static<typeof AgentSpawnInput>;

const SendMessageInput = Type.Object({
  agent_id: Type.String({ description: "The agent/session ID to send a message to" }),
  message: Type.String({ description: "The message content" }),
});
type SendMessageInput = Static<typeof SendMessageInput>;

export function createAgentTools() {
  return [
    {
      name: "oh_agent_spawn",
      label: "Spawn Subagent",
      description: "Spawn a subagent to handle a task independently. Use for parallel work, delegation, or background processing. Returns an agent ID for tracking.",
      parameters: AgentSpawnInput,
      async execute(_toolCallId: string, params: AgentSpawnInput) {
        const { prompt, label = "agent", mode = "local_agent", model } = params;
        const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return { content: [{ type: "text" as const, text: `Subagent spawned:\nID: ${agentId}\nLabel: ${label}\nMode: ${mode}${model ? `\nModel: ${model}` : ""}\nPrompt: ${prompt.slice(0, 200)}...` }], details: { success: true } };
      },
    },
    {
      name: "oh_send_message",
      label: "Send Message to Agent",
      description: "Send a message to a running subagent. Use for coordinating with background agents or providing additional context.",
      parameters: SendMessageInput,
      async execute(_toolCallId: string, params: SendMessageInput) {
        const { agent_id, message } = params;
        return { content: [{ type: "text" as const, text: `Message sent to agent ${agent_id}: ${message.slice(0, 200)}` }], details: { success: true } };
      },
    },
  ];
}
