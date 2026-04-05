import { Type } from "@sinclair/typebox";

const TEMPLATES: Record<string, Record<string, unknown>> = {
  person: {

    email: "<string>",
    age: "<number>",
    bio: "<string>",
  },
  project: {

    version: "<string>",
    dependencies: {},
    scripts: {},
  },
  task: {
    title: "<string>",

    status: "<string>",
    priority: "<string>",
    assignee: "<string>",
    due_date: "<string>",
  },
  config: {
    environment: "<string>",
    settings: {},
    features: [],
    limits: {},
  },
  api_response: {
    status: "<number>",
    data: {},
    error: "null",
    pagination: {
      page: "<number>",
      per_page: "<number>",
      total: "<number>",
    },
  },
};

function inferTypeFromWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.includes("age") || w.includes("count") || w.includes("number") || w.includes("quantity") || w.includes("amount") || w.includes("price") || w.includes("cost") || w.includes("id") || w.includes("year") || w.includes("size") || w.includes("level") || w.includes("score") || w.includes("rating") || w.includes("duration") || w.includes("weight") || w.includes("height") || w.includes("width") || w.includes("length") || w.includes("depth") || w.includes("volume") || w.includes("temperature") || w.includes("percentage") || w.includes("probability") || w.includes("priority")) {
    return "<number>";
  }
  if (w.includes("is_") || w.includes("has_") || w.includes("enabled") || w.includes("active") || w.includes("visible") || w.includes("valid") || w.includes("required") || w.includes("available") || w.includes("approved") || w.includes("completed") || w.includes("deleted") || w.includes("archived") || w.includes("published") || w.includes("verified") || w.includes("confirmed") || w.includes("subscribed") || w.includes("online") || w.includes("locked") || w.includes("private") || w.includes("public") || w.includes("premium") || w.includes("featured")) {
    return "<boolean>";
  }
  if (w.includes("date") || w.includes("time") || w.includes("created") || w.includes("updated") || w.includes("modified") || w.includes("expires") || w.includes("due") || w.includes("start") || w.includes("end") || w.includes("timestamp") || w.includes("deadline") || w.includes("birthday") || w.includes("dob")) {
    return "<string>";
  }
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) {
    return "[]";
  }
  if (w.includes("email") || w.includes("url") || w.includes("phone") || w.includes("address") || w.includes("name") || w.includes("title") || w.includes("description") || w.includes("content") || w.includes("body") || w.includes("text") || w.includes("message") || w.includes("note") || w.includes("comment") || w.includes("bio") || w.includes("summary") || w.includes("label") || w.includes("tag") || w.includes("category") || w.includes("type") || w.includes("status") || w.includes("role") || w.includes("username") || w.includes("password") || w.includes("token") || w.includes("key") || w.includes("value") || w.includes("source") || w.includes("target") || w.includes("path") || w.includes("format") || w.includes("language") || w.includes("locale") || w.includes("timezone") || w.includes("currency") || w.includes("unit") || w.includes("color") || w.includes("image") || w.includes("avatar") || w.includes("icon") || w.includes("file") || w.includes("filename") || w.includes("extension") || w.includes("mimetype") || w.includes("slug") || w.includes("code") || w.includes("reference") || w.includes("identifier")) {
    return "<string>";
  }
  return "<string>";
}

function parseDescription(description: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const segments = description.split(/[,;]+| and | with /i);
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/);
    const key = words[words.length - 1]?.replace(/[.,!?;:]+$/, "") || trimmed;
    if (key && key.length < 50 && !["a", "an", "the", "of", "with", "for", "to", "in", "on", "at", "by", "from", "is", "are", "was", "were", "has", "have", "had", "been", "being", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "that", "this", "these", "those", "it", "its", "their", "my", "your", "his", "her", "our", "their", "which", "who", "whom", "whose", "what", "where", "when", "why", "how", "all", "each", "every", "both", "few", "many", "much", "some", "any", "no", "not", "only", "own", "same", "so", "than", "too", "very", "just", "also", "now", "here", "there", "then", "once", "twice", "again", "further", "more", "most", "other", "another", "such", "only", "about", "above", "below", "between", "into", "through", "during", "before", "after", "up", "down", "out", "off", "over", "under", "person", "object", "thing", "item", "entity", "record", "entry", "data", "information", "details", "structure", "schema", "model", "type", "class", "instance", "example", "sample", "template", "output", "result", "response", "request", "payload", "body", "header", "footer", "content", "element", "component", "module", "package", "library", "framework", "system", "application", "service", "api", "endpoint", "route", "path", "url", "uri", "link", "reference", "pointer", "index", "key", "value", "pair", "tuple", "array", "list", "set", "map", "dict", "hash", "table", "grid", "matrix", "vector", "graph", "tree", "node", "edge", "vertex", "point", "line", "curve", "shape", "form", "figure", "image", "picture", "photo", "video", "audio", "sound", "music", "song", "track", "album", "artist", "author", "writer", "creator", "owner", "user", "admin", "manager", "director", "leader", "head", "chief", "boss", "president", "ceo", "cto", "cfo", "coo", "cmo", "cio", "ciso", "cdo", "cvo", "cro", "cgo", "cpo", "cao", "cco", "clo", "cno", "cso", "cwo", "cxo", "cyo", "czo"].includes(key.toLowerCase())) {
      result[key] = inferTypeFromWord(key);
    }
  }
  if (Object.keys(result).length === 0) {
    result.description = "<string>";
  }
  return result;
}

export function registerStructuredOutput(api: any) {

    api.registerTool({

      name: "oh_structured_output",
      label: "Structured Output",

      parameters: Type.Object({
        description: Type.String({ description: "Natural language description of the desired output structure" }),
        schema_hint: Type.Optional(Type.String({ description: "Optional JSON Schema hint to guide generation" })),
        pretty: Type.Optional(Type.Boolean({ description: "Whether to pretty-print the JSON output", default: true })),
      }),
      async execute(_toolCallId: string, params: any) {
        const { description, schema_hint, pretty = true } = params;
        let output: Record<string, unknown>;
        if (schema_hint) {
          try {
            const parsed = JSON.parse(schema_hint);
            output = parsed;
          } catch {
            output = parseDescription(description);
          }
        } else {
          output = parseDescription(description);
        }
        const jsonStr = pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
        return {
          content: [{ type: "text" as const, text: jsonStr }],
          details: { success: true, fields: Object.keys(output).length },
        };
      },
    });
}
