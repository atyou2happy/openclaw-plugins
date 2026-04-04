import { Type, type Static } from "@sinclair/typebox";

const EnterPlanModeInput = Type.Object({});
type EnterPlanModeInput = Static<typeof EnterPlanModeInput>;

const ExitPlanModeInput = Type.Object({});
type ExitPlanModeInput = Static<typeof ExitPlanModeInput>;

export function createPlanModeTools() {
  return {
    enterPlanMode: {
      name: "oh_enter_plan_mode",
      label: "Enter Plan Mode",
      description: "Switch to plan mode. In this mode, all write/execute operations are blocked. Use for designing large refactors or reviewing changes before committing.",
      parameters: EnterPlanModeInput,
      async execute(_toolCallId: string, _params: EnterPlanModeInput) {
        return { content: [{ type: "text" as const, text: "Plan mode enabled. Write operations are now blocked. Use oh_exit_plan_mode to exit." }], details: { success: true } };
      },
    },
    exitPlanMode: {
      name: "oh_exit_plan_mode",
      label: "Exit Plan Mode",
      description: "Exit plan mode and re-enable all operations.",
      parameters: ExitPlanModeInput,
      async execute(_toolCallId: string, _params: ExitPlanModeInput) {
        return { content: [{ type: "text" as const, text: "Plan mode disabled. All operations re-enabled." }], details: { success: true } };
      },
    },
  };
}
