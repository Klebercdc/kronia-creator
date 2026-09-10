import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import { recordUsage } from "./cost-tracker";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
  }
  return client;
}

/** Reservado pras peças críticas que exigem julgamento fino: visão, doutrina, direito autoral. */
export const DEFAULT_MODEL = "gpt-4o-mini";

export class LLMValidationError extends Error {
  constructor(
    message: string,
    public readonly raw: unknown,
  ) {
    super(message);
    this.name = "LLMValidationError";
  }
}

/** Força todo objeto do schema a ter additionalProperties:false e TODAS as
 * propriedades em "required" — exigência do modo strict da OpenAI. Sem isso
 * (e confiando só na descrição em texto), modelos menores como o gpt-4o-mini
 * confundem a descrição do schema com os dados de resposta em schemas grandes. */
function enforceStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(enforceStrict);
  if (node === null || typeof node !== "object") return node;

  const obj = { ...(node as Record<string, unknown>) };
  for (const key of Object.keys(obj)) {
    obj[key] = enforceStrict(obj[key]);
  }

  if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
    obj.additionalProperties = false;
    obj.required = Object.keys(obj.properties as Record<string, unknown>);
  }

  return obj;
}

function toJsonSchema(schema: z.ZodType) {
  const { $schema, ...rest } = zodToJsonSchema(schema, { target: "openApi3" }) as Record<string, unknown>;
  return enforceStrict(rest) as Record<string, unknown>;
}

async function imageToDataUrl(path: string): Promise<string> {
  const buf = await readFile(path);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function runStructuredChat<T>(params: {
  schema: z.ZodType<T>;
  system: string;
  userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[];
  toolName: string;
  model: string;
  maxAttempts: number;
}): Promise<T> {
  const { schema, system, userContent, toolName, model, maxAttempts } = params;

  const jsonSchema = toJsonSchema(schema);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];

  let lastRaw: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await getClient().chat.completions.create({
      model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: toolName, schema: jsonSchema, strict: true },
      },
    });

    recordUsage({
      provider: "openai",
      tool: toolName,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
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

/**
 * Chamada multimodal (frames + texto) com saída estruturada validada por Zod.
 * Usada só na Ingestão, pra ler frames de vídeo — a Groq não tem modelo com visão.
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
  const { framePaths, ...rest } = params;
  const images = await Promise.all(framePaths.map(imageToDataUrl));
  return callStructuredVisionFromDataUrls({ ...rest, images });
}

/**
 * Mesma chamada multimodal, mas recebendo as imagens já como data URL —
 * usada quando a imagem veio do navegador (upload) em vez de um arquivo no
 * disco do servidor.
 */
export async function callStructuredVisionFromDataUrls<T>(params: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  images: string[];
  toolName: string;
  model?: string;
  maxAttempts?: number;
}): Promise<T> {
  const { schema, system, prompt, images, toolName, model = DEFAULT_MODEL, maxAttempts = 2 } = params;
  const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = images.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));

  return runStructuredChat({
    schema,
    system,
    userContent: [{ type: "text", text: prompt }, ...imageContent],
    toolName,
    model,
    maxAttempts,
  });
}

/**
 * Chamada só-texto com saída estruturada validada por Zod — reservada pros
 * agentes onde a nuance de julgamento importa mais que custo: Teólogo,
 * Psicologia de Compra, Copyright. O resto do texto roda na Groq (grátis).
 */
export async function callStructuredText<T>(params: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  toolName: string;
  model?: string;
  maxAttempts?: number;
}): Promise<T> {
  const { schema, system, prompt, toolName, model = DEFAULT_MODEL, maxAttempts = 2 } = params;

  return runStructuredChat({
    schema,
    system,
    userContent: [{ type: "text", text: prompt }],
    toolName,
    model,
    maxAttempts,
  });
}
