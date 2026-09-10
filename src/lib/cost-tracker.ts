import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Registro de uso de API, inspirado no CostTracker do TikTok Viral Factory
 * (repo auditado): loga cada chamada num arquivo local (logs/usage.jsonl,
 * fora do git) e avisa no console quando o uso do dia se aproxima do teto —
 * pra nunca mais bater cota (Groq) ou levar susto de fatura (OpenAI) sem
 * aviso, como aconteceu nos testes de hoje.
 *
 * Preço da OpenAI é aproximado (gpt-4o-mini, US$ por milhão de tokens) —
 * só pra dar noção de custo, não é fatura oficial. Groq é grátis: rastreamos
 * contra o teto diário de tokens (TPD), não em dinheiro.
 */

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "usage.jsonl");

const OPENAI_PRICE_PER_1M = { input: 0.15, output: 0.6 };
const GROQ_DAILY_TOKEN_BUDGET = Number(process.env.GROQ_DAILY_TOKEN_BUDGET ?? 200_000);

type Provider = "groq" | "openai";

interface UsageEntry {
  timestamp: string;
  provider: Provider;
  tool: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

let todayGroqTokens = 0;
let todayKey = new Date().toISOString().slice(0, 10);

function resetIfNewDay() {
  const key = new Date().toISOString().slice(0, 10);
  if (key !== todayKey) {
    todayKey = key;
    todayGroqTokens = 0;
  }
}

function estimateCostUsd(provider: Provider, promptTokens: number, completionTokens: number): number {
  if (provider !== "openai") return 0;
  return (promptTokens / 1_000_000) * OPENAI_PRICE_PER_1M.input + (completionTokens / 1_000_000) * OPENAI_PRICE_PER_1M.output;
}

/** Chamado depois de toda resposta da Groq/OpenAI — nunca lança erro (uso
 * é observabilidade, não pode derrubar o pipeline se o disco falhar). */
export function recordUsage(params: {
  provider: Provider;
  tool: string;
  promptTokens: number;
  completionTokens: number;
}): void {
  const { provider, tool, promptTokens, completionTokens } = params;
  resetIfNewDay();

  const totalTokens = promptTokens + completionTokens;
  const entry: UsageEntry = {
    timestamp: new Date().toISOString(),
    provider,
    tool,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd(provider, promptTokens, completionTokens),
  };

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch {
    // Observabilidade não pode quebrar o pipeline — se não der pra logar, segue o jogo.
  }

  if (provider === "groq") {
    todayGroqTokens += totalTokens;
    const ratio = todayGroqTokens / GROQ_DAILY_TOKEN_BUDGET;
    if (ratio >= 0.8) {
      console.warn(
        `[uso] Groq em ${Math.round(ratio * 100)}% da cota diária estimada (${todayGroqTokens}/${GROQ_DAILY_TOKEN_BUDGET} tokens) — risco de 429 em breve.`,
      );
    }
  }
}
