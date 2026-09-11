/**
 * Servidor HTTP local que imita a API de chat completions (Groq e OpenAI são
 * ambas compatíveis com o formato da OpenAI). Em vez de gerar conteúdo real,
 * lê o JSON Schema embutido na requisição (nativo no `response_format` da
 * OpenAI, ou descrito em texto no prompt da Groq) e preenche uma instância
 * mínima válida — o suficiente pra exercitar o código real (parsing, retry,
 * validação Zod, loop de compliance, injeção do ator principal) sem gastar
 * tokens nem depender de cota de API.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

type JsonSchema = Record<string, any>;

let counter = 0;

/** Resolve um JSON Pointer local (ex.: "#/properties/checkedGroups/items")
 * contra a raiz do próprio schema — zod-to-json-schema usa isso pra deduplicar
 * enums repetidos em vez de reescrevê-los toda vez. */
function resolveRef(ref: string, root: JsonSchema): JsonSchema {
  const path = ref.replace(/^#\//, "").split("/");
  let node: unknown = root;
  for (const segment of path) {
    node = (node as Record<string, unknown>)?.[segment];
  }
  if (!node || typeof node !== "object") {
    throw new Error(`mock-llm: não consegui resolver $ref "${ref}"`);
  }
  return node as JsonSchema;
}

function fillSchema(schema: JsonSchema, root: JsonSchema = schema): unknown {
  if (schema.$ref) return fillSchema(resolveRef(schema.$ref, root), root);
  if (schema.enum) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;

  switch (schema.type) {
    case "object": {
      const props: Record<string, JsonSchema> = schema.properties ?? {};
      const keys: string[] = schema.required ?? Object.keys(props);
      const obj: Record<string, unknown> = {};
      for (const key of keys) {
        if (props[key]) obj[key] = fillSchema(props[key], root);
      }
      return obj;
    }
    case "array": {
      const count = schema.minItems ?? 1;
      return Array.from({ length: count }, () => fillSchema(schema.items ?? {}, root));
    }
    case "string":
      counter += 1;
      if (schema.format === "uri") return "https://exemplo.com/mock";
      return `Texto de teste offline #${counter} (mock-llm).`;
    case "integer":
    case "number": {
      const base = schema.minimum ?? 1;
      return schema.exclusiveMinimum ? base + 1 : base;
    }
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return null;
  }
}

function extractGroqSchema(systemContent: string): JsonSchema | null {
  const marker = "correspondendo exatamente a este schema:\n";
  const idx = systemContent.indexOf(marker);
  if (idx === -1) return null;
  return JSON.parse(systemContent.slice(idx + marker.length).trim());
}

function schemaFromBody(body: any): JsonSchema | null {
  if (body.response_format?.type === "json_schema") {
    return body.response_format.json_schema.schema;
  }
  if (body.response_format?.type === "json_object") {
    const systemMsg = body.messages?.find((m: any) => m.role === "system");
    return systemMsg ? extractGroqSchema(String(systemMsg.content)) : null;
  }
  return null;
}

function chatCompletionEnvelope(content: string) {
  return {
    id: "mock-llm",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "mock-llm",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

export async function startMockLLMServer(): Promise<{ url: string; stop: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        const body = JSON.parse(raw);
        const schema = schemaFromBody(body);
        if (!schema) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "mock-llm: schema não encontrado na requisição" }));
          return;
        }
        const fake = fillSchema(schema);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(chatCompletionEnvelope(JSON.stringify(fake))));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
