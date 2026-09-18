/**
 * Preenche a prévia de cada movimento da Biblioteca de Movimentos
 * (src/data/movement-library.json) com um vídeo stock aproximado da API
 * gratuita do Pexels — não é o gesto exato do prompt, é a melhor
 * combinação de palavra-chave disponível, servindo de placeholder real
 * até (se algum dia fizer sentido) trocar pelos clipes gerados de verdade
 * (ver scripts/generate-movement-videos.ts).
 *
 * Uso:
 *   PEXELS_API_KEY=xxxxx npm run match-movement-stock-videos
 *   PEXELS_API_KEY=xxxxx npm run match-movement-stock-videos -- --limit 5
 *   PEXELS_API_KEY=xxxxx npm run match-movement-stock-videos -- --category blusas-cropped-body-corset
 *   PEXELS_API_KEY=xxxxx npm run match-movement-stock-videos -- --force   # reprocessa mesmo quem já tem videoUrl
 *
 * Como conseguir a key: pexels.com/api — cadastro grátis, sem cartão,
 * key liberada na hora. Limite generoso no plano grátis (200 req/hora,
 * 20.000/mês) — 228 buscas cabem tranquilo numa rodada só.
 *
 * Como funciona o match: cada movimento tem um título curto em português
 * (ex: "Mão no cabelo + sorriso") — MOVEMENT_KEYWORDS abaixo traduz os
 * termos mais comuns do dataset pra inglês (é o que a busca do Pexels
 * entende melhor) e monta a query "woman + <termo> + <peça de roupa>".
 * Resultado sem vídeo bom o bastante fica sem videoUrl (não força um
 * vídeo genérico demais) — roda de novo depois de ajustar
 * MOVEMENT_KEYWORDS se muita coisa ficar sem match.
 *
 * Filtro de qualidade: pede até 8 candidatos por busca e descarta os em
 * preto-e-branco (comum no catálogo "moody fashion film" da Pexels — vídeo
 * sem cor esconde a peça de roupa, que é o que a usuária precisa ver).
 * Detecção via `ffprobe`/filtro `signalstats` na miniatura de cada
 * candidato (SATAVG ~0 = P&B) — precisa de `ffmpeg` instalado na máquina
 * que roda o script (não entra no build do app, só na hora de gerar o
 * dataset). Sem ffmpeg, o filtro de cor é pulado com aviso, mas o resto
 * do script funciona igual. `--force` reprocessa também quem já tem
 * videoUrl (útil pra rodar de novo com esse filtro novo).
 */
import "dotenv/config";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
const API_BASE = "https://api.pexels.com/videos/search";

const apiKey = process.env.PEXELS_API_KEY;
if (!apiKey) {
  console.error("Faltou PEXELS_API_KEY. Ex: PEXELS_API_KEY=xxxxx npm run match-movement-stock-videos");
  process.exit(1);
}

const args = process.argv.slice(2);
function argValue(name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}
const limit = argValue("limit") ? Number(argValue("limit")) : null;
const onlyCategory = argValue("category");
const force = args.includes("--force");

const MIN_SATURATION = 3; // SATAVG do ffprobe: ~0 é preto-e-branco, cor de verdade fica bem acima disso
const MAX_CANDIDATES_CHECKED = 5;

let ffmpegAvailable = true;
async function isColorThumbnail(imageUrl: string, tmpDir: string): Promise<boolean> {
  if (!ffmpegAvailable) return true; // sem ffmpeg, não filtra — melhor um match não checado que nenhum
  const imgPath = join(tmpDir, `thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return true; // não deu pra baixar a miniatura — deixa passar, não é motivo pra descartar o vídeo
    writeFileSync(imgPath, Buffer.from(await res.arrayBuffer()));
    const { stdout } = await execFileAsync("ffprobe", [
      "-f", "lavfi",
      "-i", `movie=${imgPath},signalstats`,
      "-show_entries", "frame_tags=lavfi.signalstats.SATAVG",
      "-of", "default=nw=1:nk=1",
      "-v", "quiet",
    ]);
    const sat = Number(stdout.trim());
    return Number.isFinite(sat) ? sat >= MIN_SATURATION : true;
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      ffmpegAvailable = false;
      console.warn("ffmpeg/ffprobe não encontrado no PATH — pulando filtro de preto-e-branco.");
    }
    return true;
  } finally {
    try { rmSync(imgPath, { force: true }); } catch { /* arquivo temporário, sem problema se já sumiu */ }
  }
}

/** Termos em português (ou trechos do título) que aparecem nos 228
 * movimentos → melhor tradução de busca pro Pexels. Checado nessa ordem;
 * o primeiro que bater no título vira o termo do gesto na query. */
const MOVEMENT_KEYWORDS: [RegExp, string][] = [
  [/cabelo/i, "touching hair"],
  [/sorri|sorriso/i, "smiling"],
  [/ajust|caimento|conferindo/i, "adjusting clothes"],
  [/virad|vira|lateral|perfil/i, "turning side pose"],
  [/cintura|quadril/i, "hands on hips"],
  [/caminhada|passo|anda/i, "walking"],
  [/toque|toca|tecido|elasticidade|estica/i, "touching fabric"],
  [/respira/i, "breathing pose"],
  [/gira|rodopia/i, "spinning twirling"],
  [/salto|pula/i, "jumping"],
  [/aponta|mostra|indica/i, "pointing showing"],
  [/produto na mão|segurando/i, "holding product"],
  [/pose|frontal/i, "posing"],
];

/** Peça de roupa pela categoria (inglês, pro termo bater melhor na
 * busca) — cobre as 11 categorias-base; as "Veo3 — X" reaproveitam a
 * mesma peça da categoria correspondente. */
const CATEGORY_GARMENT: [RegExp, string][] = [
  [/blusa|cropped|body|corset/i, "blouse"],
  [/cal[cç]a|short/i, "pants"],
  [/vestido/i, "dress"],
  [/academia/i, "activewear"],
  [/frio|jaqueta|moletom/i, "jacket"],
  [/cabide/i, "clothing rack"],
];

function buildQuery(entry: MovementEntry): string {
  const movementTerm = MOVEMENT_KEYWORDS.find(([re]) => re.test(entry.title))?.[1] ?? "posing fashion";
  const garment = CATEGORY_GARMENT.find(([re]) => re.test(entry.category))?.[1] ?? "outfit";
  return `woman ${movementTerm} ${garment}`;
}

function loadEntries(): MovementEntry[] {
  return JSON.parse(readFileSync(DATA_PATH, "utf-8"));
}

function saveEntries(entries: MovementEntry[]) {
  writeFileSync(DATA_PATH, JSON.stringify(entries, null, 2) + "\n");
}

interface PexelsVideoFile {
  link: string;
  quality: string;
  width: number;
  height: number;
}
interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  image: string; // miniatura estática (jpg) — usada só pra checar cor, nunca vira videoUrl
  video_files: PexelsVideoFile[];
}

function pickVideoFile(video: PexelsVideo): string | null {
  // Prefere um arquivo vertical (9:16, formato do preview) de qualidade
  // média — hd pesa menos que 4k e já fica nítido no tamanho do card.
  const vertical = video.video_files.filter((f) => f.height > f.width);
  const pick = vertical.find((f) => f.quality === "hd") ?? vertical[0] ?? video.video_files[0];
  return pick?.link ?? null;
}

async function searchStockVideo(query: string, tmpDir: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}?query=${encodeURIComponent(query)}&orientation=portrait&per_page=8`, {
    headers: { Authorization: apiKey! },
  });
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { videos: PexelsVideo[] };
  if (data.videos.length === 0) return null;

  const candidates = data.videos.slice(0, MAX_CANDIDATES_CHECKED);
  for (const video of candidates) {
    if (await isColorThumbnail(video.image, tmpDir)) {
      const link = pickVideoFile(video);
      if (link) return link;
    }
  }
  // Nenhum candidato passou no filtro de cor (ou nenhum tinha arquivo
  // vertical) — melhor devolver o primeiro da lista do que ficar sem nada.
  return pickVideoFile(data.videos[0]);
}

async function main() {
  let entries = loadEntries();
  let pending = force ? entries : entries.filter((e) => !e.videoUrl);
  if (onlyCategory) pending = pending.filter((e) => e.categorySlug === onlyCategory);
  if (limit) pending = pending.slice(0, limit);

  if (pending.length === 0) {
    console.log("Nada pra buscar — todas as entradas filtradas já têm videoUrl (use --force pra reprocessar).");
    return;
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "movement-stock-"));
  console.log(`Buscando vídeo stock pra ${pending.length} movimento(s)...`);
  let matched = 0;
  let skipped = 0;

  try {
    for (const entry of pending) {
      const query = buildQuery(entry);
      try {
        const videoUrl = await searchStockVideo(query, tmpDir);
        if (!videoUrl) {
          console.log(`[${entry.id}] sem resultado pra "${query}" — deixei sem vídeo`);
          skipped += 1;
          continue;
        }
        entries = loadEntries();
        const fresh = entries.find((e) => e.id === entry.id);
        if (fresh) fresh.videoUrl = videoUrl;
        saveEntries(entries);
        matched += 1;
        console.log(`[${entry.id}] "${query}" -> OK (${matched}/${pending.length})`);
      } catch (err) {
        console.error(`[${entry.id}] FALHOU: ${err instanceof Error ? err.message : err}`);
      }
      // Respeita o limite de taxa do plano grátis (200 req/hora) sem
      // precisar de fila sofisticada — 228 buscas a 1/seg cabem em ~4min.
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\nConcluído: ${matched} com vídeo, ${skipped} sem resultado. Rode de novo pra tentar só o que faltou.`);
}

main();
