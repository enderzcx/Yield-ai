import type { AgentHistoryMessage } from "@/lib/types";

const MAX_TOOL_CHARS = 2_000;

export function createHistory(initialMessages: AgentHistoryMessage[] = []) {
  const messages = _sanitizeMessages([...initialMessages]);

  function add(message: AgentHistoryMessage) {
    if (message.role === "tool" && typeof message.content === "string") {
      messages.push({
        ...message,
        content: budgetToolResult(message.content),
      });
      return;
    }

    messages.push(message);
  }

  function addAssistant(message: AgentHistoryMessage) {
    messages.push(message);
  }

  function getMessages() {
    return _sanitizeMessages([...messages]);
  }

  return { add, addAssistant, getMessages };
}

function budgetToolResult(content: string) {
  if (content.length <= MAX_TOOL_CHARS) return content;
  return `${content.slice(0, MAX_TOOL_CHARS)}\n...[truncated ${content.length - MAX_TOOL_CHARS} chars]`;
}

export function _sanitizeMessages(messages: AgentHistoryMessage[]) {
  const toolResponseIds = new Set<string>();
  for (const message of messages) {
    if (message.role === "tool" && message.tool_call_id) {
      toolResponseIds.add(message.tool_call_id);
    }
  }

  const sanitized: AgentHistoryMessage[] = [];
  for (const message of messages) {
    if (message.role === "assistant" && message.tool_calls?.length) {
      const allMatched = message.tool_calls.every((toolCall) => toolResponseIds.has(toolCall.id));
      if (!allMatched) continue;
    }

    if (message.role === "tool" && message.tool_call_id) {
      const hasMatchingAssistant = sanitized.some(
        (entry) =>
          entry.role === "assistant" &&
          entry.tool_calls?.some((toolCall) => toolCall.id === message.tool_call_id),
      );
      if (!hasMatchingAssistant) continue;
    }

    sanitized.push(message);
  }

  return sanitized;
}
