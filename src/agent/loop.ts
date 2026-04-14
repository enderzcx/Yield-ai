import { createHistory } from "./history";
import type { AgentHistoryMessage } from "@/lib/types";

const MAX_ROUNDS = 6;

export async function* agentLoop({
  historyMessages,
  userMessage,
  llm,
  executor,
  systemPrompt,
}: {
  historyMessages: AgentHistoryMessage[];
  userMessage: string;
  llm: ReturnType<typeof import("./llm").createAgentLLM>;
  executor: ReturnType<typeof import("./executor").createToolExecutor>;
  systemPrompt: string;
}) {
  const history = createHistory(historyMessages);
  history.add({ role: "user", content: userMessage });
  let finalContent = "";

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const messages = [{ role: "system" as const, content: systemPrompt }, ...history.getMessages()];
    let result:
      | {
          message: AgentHistoryMessage;
          content: string;
          tool_calls: AgentHistoryMessage["tool_calls"];
        }
      | undefined;

    for await (const chunk of llm.chatStream(messages, { tools: executor.getToolDefs() })) {
      if ("text" in chunk && chunk.text) {
        yield { type: "text" as const, text: chunk.text };
      }

      if ("done" in chunk && chunk.done) {
        result = chunk;
      }
    }

    if (!result) {
      yield { type: "error" as const, error: "No LLM response" };
      return;
    }

    history.addAssistant(result.message);
    finalContent = result.content ?? finalContent;

    if (!result.tool_calls?.length) {
      yield { type: "done" as const, content: finalContent, rounds: round + 1 };
      return;
    }

    for (const toolCall of result.tool_calls) {
      const name = toolCall.function.name;
      const args = safeJsonParse(toolCall.function.arguments);

      if (executor.needsConfirmation(name)) {
        yield {
          type: "confirm_needed" as const,
          name,
          args,
          description: executor.describeAction(name, args),
        };
        return;
      }

      yield { type: "tool_start" as const, name, args };

      const startedAt = Date.now();
      const toolResult = await executor.execute(name, args);
      const duration_ms = Date.now() - startedAt;

      yield { type: "tool_result" as const, name, result: toolResult, duration_ms };

      history.add({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  yield { type: "done" as const, content: finalContent, rounds: MAX_ROUNDS };
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input) as Record<string, unknown>;
  } catch {
    return {};
  }
}
