import Groq from "groq-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";

let client: Groq | null = null;

function getClient(): Groq {
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

/** Modelo padrão com bom suporte a tool-calling na camada gratuita da Groq.
 * Confira `console.groq.com/docs/models` de tempos em tempos — o catálogo muda. */
export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class LLMValidationError extends Error {
  constructor(
    message: string,
    public readonly raw: unknown,
  ) {
    super(message);
    this.name = "LLMValidationError";
  }
}

function toJsonSchema(schema: z.ZodType) {
  const { $schema, ...rest } = zodToJsonSchema(schema, { target: "openApi3" }) as Record<string, unknown>;
  return rest;
}

/**
 * Chama a Groq com uma tool forçada para obter saída estruturada, validada
 * contra `schema` em runtime. Se a validação falhar, devolve o erro pro
 * modelo e tenta mais uma vez antes de desistir — nunca aceita um payload
 * que não bate com o schema esperado.
 */
export async function callStructured<T>(params: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  toolName: string;
  model?: string;
  maxAttempts?: number;
}): Promise<T> {
  const { schema, system, prompt, toolName, model = DEFAULT_MODEL, maxAttempts = 2 } = params;

  const tool: Groq.Chat.Completions.ChatCompletionTool = {
    type: "function",
    function: {
      name: toolName,
      description: `Retorna o resultado de ${toolName} como dado estruturado.`,
      parameters: toJsonSchema(schema) as Record<string, unknown>,
    },
  };

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];

  let lastRaw: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await getClient().chat.completions.create({
      model,
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new LLMValidationError(`Modelo não retornou tool_call para ${toolName}`, response);
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new LLMValidationError(`Argumentos de ${toolName} não são JSON válido`, toolCall.function.arguments);
    }

    lastRaw = parsedArgs;
    const parsed = schema.safeParse(parsedArgs);
    if (parsed.success) return parsed.data;

    if (attempt < maxAttempts) {
      messages.push(
        { role: "assistant", content: null, tool_calls: [toolCall] },
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: `A saída não bateu com o schema esperado: ${parsed.error.message}. Corrija e retorne novamente via ${toolName}.`,
        },
      );
    }
  }

  throw new LLMValidationError(`Falha de validação para ${toolName} após ${maxAttempts} tentativas`, lastRaw);
}
