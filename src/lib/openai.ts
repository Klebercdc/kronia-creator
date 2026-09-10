import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/** Reservado pra peça crítica que a Groq não cobre: leitura visual de frames. */
export const DEFAULT_VISION_MODEL = "gpt-4o-mini";

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

async function imageToDataUrl(path: string): Promise<string> {
  const buf = await readFile(path);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/**
 * Chamada multimodal (frames + texto) à OpenAI com saída estruturada validada por
 * Zod, mesmo padrão de retry do lib/llm.ts (Groq) — só que aqui é a exceção paga,
 * usada só onde a Groq não tem modelo com visão.
 */
export async function callStructuredVision<T>(params: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  framePaths: string[];
  toolName: string;
  model?: string;
  maxAttempts?: number;
}): Promise<T> {
  const { schema, system, prompt, framePaths, toolName, model = DEFAULT_VISION_MODEL, maxAttempts = 2 } = params;

  const images = await Promise.all(framePaths.map(imageToDataUrl));
  const schemaDescription = JSON.stringify(toJsonSchema(schema));
  const systemWithSchema = `${system}

Responda APENAS com um objeto JSON válido para "${toolName}", sem markdown, sem texto fora do
JSON, correspondendo exatamente a este schema:
${schemaDescription}`;

  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = images.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemWithSchema },
    { role: "user", content: [{ type: "text", text: prompt }, ...imageContent] },
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
