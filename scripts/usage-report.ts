/**
 * Resumo de uso de API a partir de logs/usage.jsonl (gerado por
 * src/lib/cost-tracker.ts). Uso: npm run usage
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOG_FILE = join(process.cwd(), "logs", "usage.jsonl");

interface UsageEntry {
  timestamp: string;
  provider: "groq" | "openai";
  tool: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

if (!existsSync(LOG_FILE)) {
  console.log("Nenhum uso registrado ainda (logs/usage.jsonl não existe) — rode o pipeline primeiro.");
  process.exit(0);
}

const lines = readFileSync(LOG_FILE, "utf-8").trim().split("\n").filter(Boolean);
const entries: UsageEntry[] = lines.map((line) => JSON.parse(line));

const today = new Date().toISOString().slice(0, 10);
const todayEntries = entries.filter((e) => e.timestamp.startsWith(today));

function summarize(label: string, list: UsageEntry[]) {
  const byProvider = { groq: { tokens: 0, calls: 0 }, openai: { tokens: 0, calls: 0, costUsd: 0 } };
  for (const e of list) {
    if (e.provider === "groq") {
      byProvider.groq.tokens += e.totalTokens;
      byProvider.groq.calls += 1;
    } else {
      byProvider.openai.tokens += e.totalTokens;
      byProvider.openai.calls += 1;
      byProvider.openai.costUsd += e.estimatedCostUsd;
    }
  }
  console.log(`\n${label}`);
  console.log(`  Groq:   ${byProvider.groq.calls} chamadas, ${byProvider.groq.tokens} tokens (grátis)`);
  console.log(
    `  OpenAI: ${byProvider.openai.calls} chamadas, ${byProvider.openai.tokens} tokens, ~US$ ${byProvider.openai.costUsd.toFixed(4)}`,
  );
}

summarize(`Hoje (${today})`, todayEntries);
summarize("Total (desde o início do log)", entries);

const byTool = new Map<string, number>();
for (const e of entries) byTool.set(e.tool, (byTool.get(e.tool) ?? 0) + e.totalTokens);
console.log("\nPor agente (tokens totais):");
for (const [tool, tokens] of [...byTool.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${tool}: ${tokens}`);
}
