import { Type } from "@sinclair/typebox";

export function registerInteractive(api: any) {

    api.registerTool({
      name: "oh_ask_user_question",
      label: "Ask User Question",

      parameters: Type.Object({
        question: Type.String({ description: "The question to ask the user" }),
        choices: Type.Optional(Type.Array(Type.String(), { description: "Optional list of choices (for multiple choice questions)" })),
        default_choice: Type.Optional(Type.Number({ description: "Default choice index (0-based)" })),
        timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 300)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        let prompt = `❓ ${params.question}`;
        if (params.choices && params.choices.length > 0) {
          prompt += "\n\nChoices:";
          for (let i = 0; i < params.choices.length; i++) {
            const marker = params.default_choice === i ? " [default]" : "";
            prompt += `\n  ${i + 1}. ${params.choices[i]}${marker}`;
          }
          if (params.default_choice !== undefined) {
            prompt += `\n\n(Default: ${params.choices[params.default_choice]})`;
          }
        }
        prompt += `\n\n⏳ Waiting for user response (timeout: ${params.timeout || 300}s)...`;

        return {
          content: [{ type: "text" as const, text: prompt }],
          details: { success: true, type: params.choices ? "multiple-choice" : "open-ended", choices: params.choices?.length || 0 },
        };
      },
    });

    api.registerTool({
      name: "oh_confirm_action",
      label: "Confirm Action",

      parameters: Type.Object({
        message: Type.String({ description: "Description of the action to confirm" }),
        detail: Type.Optional(Type.String({ description: "Additional details about the action" })),
        danger_level: Type.Optional(Type.String({ description: "Risk level of the action", enum: ["low", "medium", "high", "critical"] })),
      }),
      async execute(_toolCallId: string, params: any) {
        const icon = params.danger_level === "critical" ? "🔴" : params.danger_level === "high" ? "🟠" : params.danger_level === "medium" ? "🟡" : "🟢";
        let prompt = `${icon} **Confirmation Required**\n\n${params.message}`;
        if (params.detail) {
          prompt += `\n\n${params.detail}`;
        }
        prompt += `\n\nType 'yes' to confirm or 'no' to cancel.`;

        return {
          content: [{ type: "text" as const, text: prompt }],
          details: { success: true, dangerLevel: params.danger_level || "low" },
        };
      },
    });

    api.registerTool({
      name: "oh_select_from_list",
      label: "Select From List",

      parameters: Type.Object({
        title: Type.String({ description: "Title for the selection prompt" }),
        items: Type.Array(Type.String(), { description: "List of items to choose from" }),
        multiple: Type.Optional(Type.Boolean({ description: "Allow multiple selections (default: false)" })),
        descriptions: Type.Optional(Type.Array(Type.String(), { description: "Optional descriptions for each item" })),
        max_display: Type.Optional(Type.Number({ description: "Maximum items to display at once (default: 20)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const maxDisplay = params.max_display || 20;
        const items = params.items.slice(0, maxDisplay);
        const hasDescriptions = params.descriptions && params.descriptions.length === params.items.length;

        let prompt = `📋 **${params.title}**\n\n`;
        prompt += `Select ${params.multiple ? "one or more" : "one"} item:\n\n`;

        for (let i = 0; i < items.length; i++) {
          const num = i + 1;
          const desc = hasDescriptions ? ` — ${params.descriptions[i]}` : "";
          prompt += `  ${num}. ${items[i]}${desc}\n`;
        }

        if (params.items.length > maxDisplay) {
          prompt += `\n  ... and ${params.items.length - maxDisplay} more`;
        }

        prompt += `\n\nEnter the number(s) of your selection.`;

        return {
          content: [{ type: "text" as const, text: prompt }],
          details: { success: true, totalItems: params.items.length, displayedItems: items.length, multiple: !!params.multiple },
        };
      },
    });

    api.registerTool({
      name: "oh_input_text",
      label: "Input Text",

      parameters: Type.Object({
        prompt: Type.String({ description: "Prompt describing what input is needed" }),
        placeholder: Type.Optional(Type.String({ description: "Example or placeholder text" })),
        multiline: Type.Optional(Type.Boolean({ description: "Allow multi-line input (default: true)" })),
        max_length: Type.Optional(Type.Number({ description: "Maximum input length (default: 4096)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        let prompt = `✏️ **Input Required**\n\n${params.prompt}`;
        if (params.placeholder) {
          prompt += `\n\nExample: \`${params.placeholder}\``;
        }
        prompt += `\n\nMax length: ${params.max_length || 4096} characters`;
        if (params.multiline) {
          prompt += "\n(Multi-line input supported)";
        }
        prompt += "\n\nPlease provide your input:";

        return {
          content: [{ type: "text" as const, text: prompt }],
          details: { success: true, multiline: !!params.multiline, maxLength: params.max_length || 4096 },
        };
      },
    });
  }
