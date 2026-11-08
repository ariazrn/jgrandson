import { Storage } from "./index";

export interface AiMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
  toolCalls?: AiToolCall[];
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface AiTool {
  schema: any;
  execute: (args: any) => Promise<any> | any;
}

export interface AiProvider {
  chat(messages: AiMessage[], tools?: any[]): Promise<AiMessage>;
}

export interface StreamingAiProvider extends AiProvider {
  stream(messages: AiMessage[]): AsyncIterable<string>;
}

/**
 * Streams tokens to an HTTP response using Server-Sent Events (SSE).
 */
export async function streamSse(res: any, tokenStream: AsyncIterable<string>): Promise<void> {
  if (typeof res.writeHead === "function") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
  }
  for await (const token of tokenStream) {
    if (typeof res.write === "function") {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
  }
  if (typeof res.write === "function") {
    res.write("data: [DONE]\n\n");
  }
  if (typeof res.end === "function") {
    res.end();
  }
}

/**
 * Consumes an SSE stream from a client or test runner and invokes a token callback.
 */
export async function consumeSseStream(
  stream: AsyncIterable<any>,
  onToken: (token: string) => void
): Promise<string> {
  let fullText = "";
  for await (const chunk of stream) {
    const raw = typeof chunk === "string" ? chunk : chunk.toString();
    const lines = raw.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") break;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.token) {
            fullText += parsed.token;
            onToken(parsed.token);
          }
        } catch {
          fullText += payload;
          onToken(payload);
        }
      }
    }
  }
  return fullText;
}

export interface EvalCase {
  input: string;
  expectedKeywords?: string[];
  expectedPattern?: string;
  maxTokens?: number;
}

export interface EvalResult {
  passed: boolean;
  score: number;
  results: Array<{
    input: string;
    output: string;
    passed: boolean;
    reason?: string;
    durationMs: number;
  }>;
}

/**
 * Evaluates model prompts offline against benchmark criteria.
 */
export async function runPromptEval(
  cases: EvalCase[],
  runner: (input: string) => Promise<string>,
  threshold = 0.8
): Promise<EvalResult> {
  const results = [];
  let passedCount = 0;

  for (const c of cases) {
    const start = performance.now();
    const output = await runner(c.input);
    const durationMs = Math.round(performance.now() - start);

    let pass = true;
    let reason = "";

    if (c.expectedKeywords) {
      const missing = c.expectedKeywords.filter(k => !output.toLowerCase().includes(k.toLowerCase()));
      if (missing.length > 0) {
        pass = false;
        reason = `Missing keywords: ${missing.join(", ")}`;
      }
    }

    if (c.expectedPattern && !new RegExp(c.expectedPattern, "i").test(output)) {
      pass = false;
      reason = `Did not match pattern: ${c.expectedPattern}`;
    }

    if (pass) passedCount++;
    results.push({ input: c.input, output, passed: pass, reason, durationMs });
  }

  const score = cases.length > 0 ? passedCount / cases.length : 1.0;
  return {
    passed: score >= threshold,
    score,
    results,
  };
}

export class Agent {
  constructor(
    private provider: AiProvider,
    private tools: AiTool[] = [],
    private options?: { sessionId?: string }
  ) {}

  async run(prompt: string): Promise<string> {
    let messages: AiMessage[] = [];
    const sessionKey = this.options?.sessionId ? `ai_session_${this.options.sessionId}` : null;

    if (sessionKey) {
      const stored = await Storage.get(sessionKey);
      if (stored) {
        try {
          messages = JSON.parse(stored.toString("utf-8"));
        } catch {
          // ignore corrupted history
        }
      }
    }

    messages.push({ role: "user", content: prompt });
    
    // We limit tool-calling to 5 loops to prevent infinite loops in the MVP
    let loops = 0;
    while (loops < 5) {
      loops++;
      const schemas = this.tools.map(t => t.schema);
      const response = await this.provider.chat(messages, schemas.length > 0 ? schemas : undefined);
      messages.push(response);
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          const tool = this.tools.find(t => t.schema.name === call.name);
          if (tool) {
            try {
              const result = await tool.execute(call.arguments);
              messages.push({
                role: "tool",
                name: call.name,
                content: typeof result === "string" ? result : JSON.stringify(result)
              });
            } catch (err: any) {
              messages.push({
                role: "tool",
                name: call.name,
                content: `Error executing tool: ${err.message}`
              });
            }
          } else {
            messages.push({
              role: "tool",
              name: call.name,
              content: `Tool not found: ${call.name}`
            });
          }
        }
      } else {
        if (sessionKey) {
          await Storage.put(sessionKey, JSON.stringify(messages));
        }
        return response.content;
      }
    }
    
    if (sessionKey) {
      await Storage.put(sessionKey, JSON.stringify(messages));
    }
    return messages[messages.length - 1].content;
  }
}
