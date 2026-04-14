export function createToolExecutor({
  registry,
}: {
  registry: ReturnType<typeof import("./registry").createToolRegistry>;
}) {
  const executors = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();

  function registerExecutors(entries: Record<string, (args: Record<string, unknown>) => Promise<unknown>>) {
    for (const [name, executor] of Object.entries(entries)) {
      executors.set(name, executor);
    }
  }

  async function execute(name: string, args: Record<string, unknown>) {
    const executor = executors.get(name);
    if (!executor) {
      return { error: `Unknown tool: ${name}` };
    }

    try {
      return await executor(args);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown tool execution error",
      };
    }
  }

  return {
    registerExecutors,
    execute,
    getToolDefs: registry.getToolDefs,
    needsConfirmation: registry.needsConfirmation,
    describeAction: registry.describeAction,
  };
}
