import Groq from "groq-sdk";
import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import { recordUsage } from "./cost-tracker";

let groqClient: Groq | null = null;
let openAIClient: OpenAI | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY, baseURL: process.env.GROQ_BASE_URL });
  }
  return groqClient;
}

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });
  }
  return openAIClient;
}

/** Modelo padrão com bom suporte a saída JSON na camada gratuita da Groq.
 * Confira `console.groq.com/docs/models` de tempos em tempos — o catálogo muda
 * (confirmado via GET /openai/v1/models em 2026-09-10). */
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

/** Modelo de contingência usado quando a Groq não consegue atender por quota/rate limit. */
export const FALLBACK_OPENAI_MODEL = process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o-mini";

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
 * Identifica erros em que insistir na Groq não resolve a chamada atual.
 * O fallback é deliberadamente restrito a quota/rate limit e indisponibilidade
 * transitória; erros de autenticação/configuração não são mascarados.
 */
function isGroqFallbackError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    status?: number;
    code?: string;
    error?: { code?: string; type?: string; message?: string };
    message?: string;
  };

  const status = candidate.status;
  const code = String(candidate.code ?? candidate.error?.code ?? "").toLowerCase();
  const type = String(candidate.error?.type ?? "").toLowerCase();
  const message = String(candidate.message ?? candidate.error?.message ?? "").toLowerCase();

  if (status === 429) return true;
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;

  const quotaSignals = [
    "rate_limit_exceeded",
    "rate limit",
    "rate-limit",
    "quota",
    "insufficient_quota",
    "tokens exhausted",
    "token limit",
    "tokens limit",
    "too many requests",
    "credits exhausted",
    "credit limit",
    "billing limit",
  ];

  return [code, type, message].some((value) => quotaSignals.some((signal) => value.includes(signal)));
}

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

function toStrictJsonSchema(schema: z.ZodType) {
  return enforceStrict(toJsonSchema(schema)) as Record<string, unknown>;
}

async function callOpenAIFallback<T>(params: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  toolName: string;
  model: string;
}): Promise<T> {
  const { schema, system, prompt, toolName, model } = params;
  const response = await getOpenAIClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: toolName,
        schema: toStrictJsonSchema(schema),
        strict: true,
      },
    },
  });

  recordUsage({
    provider: "openai",
    tool: `${toolName}:fallback`,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new LLMValidationError(`OpenAI fallback não retornou conteúdo para ${toolName}`, response);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new LLMValidationError(`OpenAI fallback retornou JSON inválido para ${toolName}`, content);
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new LLMValidationError(
      `OpenAI fallback retornou saída incompatível com o schema de ${toolName}: ${parsed.error.message}`,
      parsedJson,
    );
  }

  return parsed.data;
}

/**
 * Chama a Groq em modo JSON e valida a saída contra `schema` em runtime.
 *
 * Resiliência de produção:
 * - Groq continua sendo sempre a primeira tentativa.
 * - Se a Groq responder com quota/rate limit/indisponibilidade transitória,
 *   a mesma operação é automaticamente repetida pela OpenAI.
 * - O schema Zod continua sendo a fonte de verdade nos dois provedores.
 * - Erros de autenticação ou configuração não são escondidos pelo fallback.
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
    try {
      const response = await getGroqClient().chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
      });

      recordUsage({
        provider: "groq",
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
    } catch (error) {
      if (isGroqFallbackError(error)) {
        console.warn(`[LLM] Groq indisponível para ${toolName}; usando OpenAI fallback.`, {
          status: (error as { status?: number }).status,
          code: (error as { code?: string }).code,
        });

        return callOpenAIFallback({
          schema,
          system,
          prompt,
          toolName,
          model: FALLBACK_OPENAI_MODEL,
        });
      }

      throw error;
    }
  }

  throw new LLMValidationError(`Falha de validação para ${toolName} após ${maxAttempts} tentativas`, lastRaw);
}
