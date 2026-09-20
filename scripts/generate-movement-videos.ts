/**
 * Gera em lote os clipes de demonstração da Biblioteca de Movimentos
 * (src/data/movement-library.json), um comando só em vez de 228 ações
 * manuais. Usa a API do Veo (Gemini API — o mesmo motor por trás do Flow)
 * via REST puro (sem SDK novo), com resumo automático: já roda de novo em
 * cima do que faltar se cair no meio, porque salva o progresso a cada vídeo
 * pronto e pula qualquer entrada que já tenha `videoUrl`.
 *
 * Uso:
 *   GEMINI_API_KEY=xxxxx npm run generate-movement-videos
 *   GEMINI_API_KEY=xxxxx npm run generate-movement-videos -- --limit 5   # testa só 5 antes de rodar tudo
 *   GEMINI_API_KEY=xxxxx npm run generate-movement-videos -- --category blusas-cropped-body-corset
 *
 * Como conseguir a key: aistudio.google.com/apikey (Google AI Studio) —
 * precisa de billing ativado no projeto Google Cloud vinculado, o Veo não
 * roda na cota gratuita. Custo é por segundo de vídeo gerado, cobrado pela
 * Google — confira o preço atual em ai.google.dev/pricing antes de rodar
 * os 228 (roda com --limit primeiro pra ver um resultado e o custo real
 * de uma leva pequena).
 *
 * Onde o vídeo fica: baixado pra public/movements/<id>.mp4 (servido como
 * arquivo estático pelo Vite/Vercel — não precisa de bucket nem CDN à
 * parte) e o campo videoUrl da entrada correspondente em
 * movement-library.json passa a apontar pra "/movements/<id>.mp4".
 */
import "dotenv/config";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface MovementEntry {
  id: string;
  group: number;
  category: string;
  categorySlug: string;
  engine: "generic" | "veo3";
  title: string;
  tag: string | null;
  durationSec: number | null;
  body: string;
  videoUrl: string | null;
}

const DATA_PATH = join(process.cwd(), "src/data/movement-library.json");
const OUTPUT_DIR = join(process.cwd(), "public/movements");
const MODEL = "veo-3.1-fast-generate-preview";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CONCURRENCY = 3;
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 6 * 60_000;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Faltou GEMINI_API_KEY. Ex: GEMINI_API_KEY=xxxxx npm run generate-movement-videos");
  process.exit(1);
}

const args = process.argv.slice(2);
function argValue(name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}
const limit = argValue("limit") ? Number(argValue("limit")) : null;
const onlyCategory = argValue("category");

function loadEntries(): MovementEntry[] {
  return JSON.parse(readFileSync(DATA_PATH, "utf-8"));
}

function saveEntries(entries: MovementEntry[]) {
  writeFileSync(DATA_PATH, JSON.stringify(entries, null, 2) + "\n");
}

/** Cada movimento já é escrito como instrução de câmera fixa/plano único
 * (ver dataset) — só reforça "sem fala, sem legenda, sem música" pro Veo
 * não tentar gerar áudio/fala por conta própria. */
function toVeoPrompt(entry: MovementEntry): string {
  return `${entry.body} Vídeo vertical, formato 9:16, sem fala, sem legenda, sem música, plano único sem cortes.`;
}

async function startGeneration(prompt: string): Promise<string> {
  const res = await fetch(`${API_BASE}/models/${MODEL}:predictLongRunning?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { aspectRatio: "9:16" },
    }),
  });
  if (!res.ok) throw new Error(`predictLongRunning falhou (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { name: string };
  return data.name; // nome da operação, usado pra fazer polling
}

async function pollOperation(operationName: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/${operationName}?key=${apiKey}`);
    if (!res.ok) throw new Error(`Polling falhou (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as {
      done?: boolean;
      error?: { message: string };
      response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri: string } }[] } };
    };
    if (data.error) throw new Error(`Geração falhou: ${data.error.message}`);
    if (data.done) {
      const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error("Operação terminou mas não veio URI de vídeo na resposta.");
      return uri;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timeout esperando a geração (${POLL_TIMEOUT_MS / 1000}s).`);
}

async function downloadVideo(uri: string, destPath: string) {
  const res = await fetch(`${uri}&key=${apiKey}`);
  if (!res.ok) throw new Error(`Download do vídeo falhou (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
}

async function generateOne(entry: MovementEntry): Promise<string> {
  const prompt = toVeoPrompt(entry);
  const operationName = await startGeneration(prompt);
  const uri = await pollOperation(operationName);
  const destPath = join(OUTPUT_DIR, `${entry.id}.mp4`);
  await downloadVideo(uri, destPath);
  return `/movements/${entry.id}.mp4`;
}

async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  async function next(): Promise<void> {
    const i = cursor++;
    if (i >= items.length) return;
    await worker(items[i]);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, next));
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  let entries = loadEntries();
  let pending = entries.filter((e) => !e.videoUrl);
  if (onlyCategory) pending = pending.filter((e) => e.categorySlug === onlyCategory);
  if (limit) pending = pending.slice(0, limit);

  if (pending.length === 0) {
    console.log("Nada pra gerar — todas as entradas filtradas já têm videoUrl.");
    return;
  }

  console.log(`Gerando ${pending.length} vídeo(s) (concorrência ${CONCURRENCY})...`);
  let done = 0;
  let failed = 0;

  await runPool(pending, CONCURRENCY, async (entry) => {
    try {
      console.log(`[${entry.id}] gerando: ${entry.title}`);
      const videoUrl = await generateOne(entry);
      // Recarrega do disco antes de escrever pra não perder progresso de
      // outra entrada salva por um worker concorrente enquanto este rodava.
      entries = loadEntries();
      const fresh = entries.find((e) => e.id === entry.id);
      if (fresh) fresh.videoUrl = videoUrl;
      saveEntries(entries);
      done += 1;
      console.log(`[${entry.id}] OK (${done}/${pending.length})`);
    } catch (err) {
      failed += 1;
      console.error(`[${entry.id}] FALHOU: ${err instanceof Error ? err.message : err}`);
    }
  });

  console.log(`\nConcluído: ${done} ok, ${failed} falharam. Rode de novo pra tentar só o que faltou.`);
}

main();
