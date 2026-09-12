import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Registro de uso de API: loga cada chamada num arquivo local
 * (logs/usage.jsonl, fora do git) pra nunca levar susto de fatura da OpenAI
 * sem aviso — provider único desde a migração pra OpenAI (Groq removido:
 * cota diária de tokens gratuita se esgotava em testes normais, e o
 * fallback pra OpenAI tinha um bug de schema — ver commit da migração).
 *
 * Preço é aproximado (gpt-4o-mini, US$ por milhão de tokens) — só pra dar
 * noção de custo, não é fatura oficial.
 */

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "usage.jsonl");

const OPENAI_PRICE_PER_1M = { input: 0.15, output: 0.6 };

type Provider = "openai";

interface UsageEntry {
  timestamp: string;
  provider: Provider;
  tool: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1_000_000) * OPENAI_PRICE_PER_1M.input + (completionTokens / 1_000_000) * OPENAI_PRICE_PER_1M.output;
}

/** Chamado depois de toda resposta da OpenAI — nunca lança erro (uso é
 * observabilidade, não pode derrubar o pipeline se o disco falhar). */
export function recordUsage(params: {
  provider: Provider;
  tool: string;
  promptTokens: number;
  completionTokens: number;
}): void {
  const { provider, tool, promptTokens, completionTokens } = params;

  const totalTokens = promptTokens + completionTokens;
  const entry: UsageEntry = {
    timestamp: new Date().toISOString(),
    provider,
    tool,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd(promptTokens, completionTokens),
  };

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch {
    // Observabilidade não pode quebrar o pipeline — se não der pra logar, segue o jogo.
  }
}
