import { Type, type Static } from "@sinclair/typebox";

export const WebFetchInput = Type.Object({
  url: Type.String({ description: "The URL to fetch content from" }),
  format: Type.Optional(Type.String({ description: "The format to return: markdown (default), text, or html", enum: ["markdown", "text", "html"] })),
});
export type WebFetchInput = Static<typeof WebFetchInput>;

export function createWebFetchTool() {
  return {
    name: "oh_web_fetch",
    label: "Fetch Web Content",
    description: "Fetches content from a specified URL and converts it to readable text. Supports markdown, text, and HTML formats.",
    parameters: WebFetchInput,
    async execute(_toolCallId: string, params: WebFetchInput) {
      const { url, format = "markdown" } = params;
      try {
        const response = await fetch(url, { redirect: "follow" });
        if (!response.ok) {
          return { content: [{ type: "text" as const, text: `HTTP ${response.status}: ${response.statusText}` }], details: { success: true } };
        }
        const text = await response.text();
        const truncated = text.length > 50000 ? text.slice(0, 50000) + "\n\n... (content truncated)" : text;
        return { content: [{ type: "text" as const, text: truncated }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error fetching URL: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
