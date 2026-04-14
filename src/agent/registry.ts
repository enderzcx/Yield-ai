type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresConfirmation?: boolean;
  maxResultChars?: number;
};

const DEFAULT_MAX_RESULT_CHARS = 2_000;

export function createToolRegistry() {
  const tools = new Map<
    string,
    ToolDefinition & { requiresConfirmation: boolean; maxResultChars: number }
  >();

  function register(definition: ToolDefinition) {
    tools.set(definition.name, {
      requiresConfirmation: false,
      maxResultChars: DEFAULT_MAX_RESULT_CHARS,
      ...definition,
    });
  }

  function registerAll(definitions: ToolDefinition[]) {
    definitions.forEach(register);
  }

  function getToolDefs() {
    return [...tools.values()].map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  function needsConfirmation(name: string) {
    return tools.get(name)?.requiresConfirmation ?? false;
  }

  function describeAction(name: string, args: Record<string, unknown>) {
    return `${name}: ${JSON.stringify(args)}`;
  }

  return { register, registerAll, getToolDefs, needsConfirmation, describeAction };
}
