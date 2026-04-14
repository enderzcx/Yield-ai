import { OPENAI_BASE_URL, OPENAI_FALLBACK_MODEL, OPENAI_MODEL } from "@/config/constants";
import { serverFetch } from "@/lib/server-fetch";
import type { AgentHistoryMessage } from "@/lib/types";

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_TOKENS = 1_200;
const DEFAULT_TEMPERATURE = 0.2;

interface LlmOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export function createAgentLLM() {
  async function chat(messages: AgentHistoryMessage[], opts: LlmOptions = {}) {
    const model = opts.model || OPENAI_MODEL;
    const body = {
      model,
      messages,
      max_tokens: opts.max_tokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    };

    const response = await serverFetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      if ((response.status === 402 || response.status === 429 || response.status >= 500) && model !== OPENAI_FALLBACK_MODEL) {
        return chat(messages, { ...opts, model: OPENAI_FALLBACK_MODEL });
      }
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: AgentHistoryMessage }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };

    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error("LLM response did not contain a message");
    }

    return {
      message,
      content: message.content ?? "",
      tool_calls: message.tool_calls ?? [],
      model: data.model ?? model,
      tokens: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
    };
  }

  async function* chatStream(messages: AgentHistoryMessage[], opts: LlmOptions = {}) {
    const model = opts.model || OPENAI_MODEL;
    const body = {
      model,
      messages,
      max_tokens: opts.max_tokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      stream: true,
      stream_options: { include_usage: true },
      ...(opts.tools?.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
    };

    const response = await serverFetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    if (!response.ok || !response.body) {
      const fallback = await chat(messages, opts);
      yield { done: true, ...fallback };
      return;
    }

    if (!(response.headers.get("content-type") || "").includes("text/event-stream")) {
      const fallback = await chat(messages, opts);
      yield { done: true, ...fallback };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";
    const toolCallsMap = new Map<
      number,
      { id: string; type: "function"; function: { name: string; arguments: string } }
    >();
    let tokens = { input: 0, output: 0, total: 0 };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;

        const chunk = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
          }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };

        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          yield { text: delta.content };
        }

        for (const toolCall of delta?.tool_calls ?? []) {
          const index = toolCall.index ?? 0;
          const current = toolCallsMap.get(index) ?? {
            id: "",
            type: "function" as const,
            function: { name: "", arguments: "" },
          };

          if (toolCall.id) current.id = toolCall.id;
          if (toolCall.function?.name) current.function.name = toolCall.function.name;
          if (toolCall.function?.arguments) current.function.arguments += toolCall.function.arguments;
          toolCallsMap.set(index, current);
        }

        if (chunk.usage) {
          tokens = {
            input: chunk.usage.prompt_tokens ?? 0,
            output: chunk.usage.completion_tokens ?? 0,
            total: chunk.usage.total_tokens ?? 0,
          };
        }
      }
    }

    const tool_calls = [...toolCallsMap.values()];
    yield {
      done: true,
      message: {
        role: "assistant" as const,
        content: fullContent || null,
        ...(tool_calls.length ? { tool_calls } : {}),
      },
      content: fullContent,
      tool_calls,
      model,
      tokens,
    };
  }

  return { chat, chatStream };
}
