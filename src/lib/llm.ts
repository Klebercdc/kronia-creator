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

/** Modelo padrão com bom suporte a saída JSON na camada gratuita da Groq.
 * Confira `console.groq.com/docs/models` de tempos em tempos — o catálogo muda
 * (confirmado via GET /openai/v1/models em 2026-09-10). */
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

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
 * Chama a Groq em modo JSON (mais confiável que tool-calling forçado nos
 * modelos abertos hospedados lá) e valida a saída contra `schema` em
 * runtime. Se a validação falhar (ou o JSON vier quebrado), devolve o erro
 * pro modelo e tenta mais uma vez antes de desistir — nunca aceita um
 * payload que não bate com o schema esperado.
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

  const schemaDescription = JSON.stringify(toJsonSchema(schema));
  const systemWithSchema = `${system}

Responda APENAS com um objeto JSON válido para "${toolName}", sem markdown, sem texto fora do
JSON, correspondendo exatamente a este schema:
${schemaDescription}`;

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemWithSchema },
    { role: "user", content: prompt },
  ];

  let lastRaw: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await getClient().chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new LLMValidationError(`Modelo não retornou conteúdo para ${toolName}`, response);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      lastRaw = content;
      if (attempt < maxAttempts) {
        messages.push(
          { role: "assistant", content },
          { role: "user", content: `Isso não é JSON válido. Responda de novo, só o objeto JSON de ${toolName}.` },
        );
        continue;
      }
      throw new LLMValidationError(`JSON inválido para ${toolName} após ${maxAttempts} tentativas`, content);
    }

    lastRaw = parsedJson;
    const parsed = schema.safeParse(parsedJson);
    if (parsed.success) return parsed.data;

    if (attempt < maxAttempts) {
      messages.push(
        { role: "assistant", content },
        {
          role: "user",
          content: `A saída não bateu com o schema esperado: ${parsed.error.message}. Corrija e responda de novo, só o objeto JSON de ${toolName}.`,
        },
      );
    }
  }

  throw new LLMValidationError(`Falha de validação para ${toolName} após ${maxAttempts} tentativas`, lastRaw);
}
