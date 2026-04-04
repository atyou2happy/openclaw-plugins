import { Type, type Static } from "@sinclair/typebox";

export const WebSearchInput = Type.Object({
  query: Type.String({ description: "The search query" }),
  num_results: Type.Optional(Type.Number({ description: "Number of results to return (default: 8)" })),
});
export type WebSearchInput = Static<typeof WebSearchInput>;

export function createWebSearchTool() {
  return {
    name: "oh_web_search",
    label: "Search Web",
    description: "Search the web for current information. Returns relevant search results with titles, URLs, and snippets.",
    parameters: WebSearchInput,
    async execute(_toolCallId: string, params: WebSearchInput) {
      const { query, num_results = 8 } = params;
      try {
        const duckduckgoUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(duckduckgoUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        const html = await response.text();
        const results: string[] = [];
        const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
        let match;
        let count = 0;
        while ((match = resultRegex.exec(html)) !== null && count < num_results) {
          results.push(`[${count + 1}] ${match[2]}\nURL: ${match[1]}\n${match[3].replace(/<[^>]*>/g, "")}\n`);
          count++;
        }
        if (results.length === 0) {
          return { content: [{ type: "text" as const, text: `No search results for: ${query}` }], details: { success: true } };
        }
        return { content: [{ type: "text" as const, text: `Search results for "${query}":\n\n${results.join("\n")}` }], details: { success: true } };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Error searching: ${err.message}` }], details: { success: true } };
      }
    },
  };
}
