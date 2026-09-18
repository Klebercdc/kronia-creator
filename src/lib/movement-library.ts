import rawEntries from "../data/movement-library.json";

/**
 * Biblioteca de movimentos pra montar prompt de vídeo (Flow/Veo3) por
 * seleção múltipla — extraída de prompt-vanmax-vv.lovable.app. Cada entrada
 * é um gesto isolado (ex: "mão no cabelo") com duração e instrução prontos;
 * a usuária escolhe vários dentro de uma categoria e o app concatena em uma
 * cena só. `videoUrl` começa null — populado depois por
 * scripts/generate-movement-videos.mjs (ver esse arquivo pra rodar o lote).
 */
export interface MovementEntry {
  id: string;
  group: number;
  category: string;
  categorySlug: string;
  /** "veo3" = categorias já escritas na convenção de prompt do Veo3/Flow (imagem de referência, câmera fixa); "generic" = as demais. */
  engine: "generic" | "veo3";
  title: string;
  tag: string | null;
  durationSec: number | null;
  body: string;
  videoUrl: string | null;
}

const ENTRIES = rawEntries as MovementEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

export interface MovementCategory {
  slug: string;
  label: string;
  group: number;
  engine: MovementEntry["engine"];
  count: number;
}

export function listMovementCategories(): MovementCategory[] {
  const byGroup = new Map<number, MovementCategory>();
  for (const e of ENTRIES) {
    const existing = byGroup.get(e.group);
    if (existing) {
      existing.count += 1;
    } else {
      byGroup.set(e.group, { slug: e.categorySlug, label: e.category, group: e.group, engine: e.engine, count: 1 });
    }
  }
  return [...byGroup.values()].sort((a, b) => a.group - b.group);
}

export function listMovementsByCategory(categorySlug: string): MovementEntry[] {
  return ENTRIES.filter((e) => e.categorySlug === categorySlug).sort((a, b) => a.id.localeCompare(b.id));
}

export function getMovementsByIds(ids: string[]): MovementEntry[] {
  const set = new Set(ids);
  return ENTRIES.filter((e) => set.has(e.id));
}

/** Concatena os movimentos selecionados, na ordem em que foram clicados, numa
 * única cena contínua com conectores simples — sem passar por LLM. Soma as
 * durações pra dar uma estimativa de tempo total do clipe. */
export function composeMovementPrompt(ids: string[]): { text: string; totalDurationSec: number } | null {
  const byId = new Map(getMovementsByIds(ids).map((e) => [e.id, e]));
  const ordered = ids.map((id) => byId.get(id)).filter((e): e is MovementEntry => Boolean(e));
  if (ordered.length === 0) return null;

  const connectors = ["Em seguida,", "Depois,", "Na sequência,", "Logo após,", "Para finalizar,"];
  const sentences = ordered.map((entry, idx) => {
    // Remove o prefixo de instrução técnica repetido ("Sem fala...") de
    // todas as partes exceto a primeira, pra não repetir a cada trecho.
    const cleaned = idx === 0 ? entry.body : entry.body.replace(/^(Sem fala[^.]*\.\s*)+/i, "");
    if (idx === 0) return cleaned;
    const connector = connectors[Math.min(idx - 1, connectors.length - 1)];
    return `${connector} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  });

  const totalDurationSec = ordered.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
  return { text: sentences.join(" "), totalDurationSec };
}
