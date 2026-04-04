import { Type, type Static } from "@sinclair/typebox";

const BriefInput = Type.Object({
  topic: Type.String({ description: "The topic to generate a brief about" }),
  max_length: Type.Optional(Type.Number({ description: "Maximum length of the brief in words (default: 200)" })),
});
type BriefInput = Static<typeof BriefInput>;

export function createBriefTool() {
  return {
    name: "oh_brief",
    label: "Generate Brief",
    description: "Generate a concise brief/summary about a topic. Use for quick overviews of codebases, features, or technical concepts.",
    parameters: BriefInput,
    async execute(_toolCallId: string, params: BriefInput) {
      const { topic, max_length = 200 } = params;
      return { content: [{ type: "text" as const, text: `Brief: ${topic}\n\n(This tool provides topic summaries. In a full implementation, this would query an LLM or knowledge base for a ${max_length}-word summary.)` }], details: { success: true } };
    },
  };
}
