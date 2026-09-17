import rawEntries from "../data/reference-library.json";

/**
 * Biblioteca de referência real — prompts reverse-engineered de vídeos
 * reais #1 em vendas por semana/mercado/categoria no TikTok Shop
 * (dataset público da Clipcat, CC BY 4.0: cada prompt cita o vídeo de
 * origem em `source`). Vive como asset estático versionado no repo (não
 * banco) porque é dado de terceiro, somente leitura, que não muda por
 * usuário — importa o JSON inteiro uma vez no boot do servidor.
 *
 * As falas citadas (`hookLine`, dentro de `promptEn`) NÃO estão cobertas
 * pela licença CC BY 4.0 do resto do prompt — nunca reproduzir literal
 * como copy final gerado pro usuário, só como referência de ritmo/estrutura.
 */
export interface ReferenceLibraryEntry {
  id: string;
  title: string;
  market: string;
  category: string;
  categorySlug: string;
  videoType: string;
  durationSec: number;
  hook: string;
  hooks: string[];
  presenter: string;
  promo: string[];
  voiceover: boolean;
  voiceoverLang: string | null;
  rankPeriod: string;
  /** Link real do vídeo original no TikTok — usado pelo TikTokPreview. */
  source: string;
  creator: string;
  hookLine: string | null;
  painPoint: string | null;
  visuals: string[];
  promptEn: string;
}

export type ReferenceLibraryCard = Omit<ReferenceLibraryEntry, "promptEn" | "visuals">;

const ENTRIES = rawEntries as ReferenceLibraryEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

function toCard(entry: ReferenceLibraryEntry): ReferenceLibraryCard {
  const { promptEn: _promptEn, visuals: _visuals, ...card } = entry;
  return card;
}

export interface ReferenceLibraryFilters {
  category?: string | null;
  market?: string | null;
  hook?: string | null;
}

export interface ReferenceLibraryPage {
  cards: ReferenceLibraryCard[];
  total: number;
}

const PAGE_SIZE = 24;

/** Lista paginada, sem `promptEn`/`visuals` (payload leve pro catálogo —
 * o texto completo só é buscado quando o usuário abre/usa uma entrada
 * específica, via `getReferenceLibraryEntry`). */
export function listReferenceLibrary(params: {
  filters?: ReferenceLibraryFilters;
  offset?: number;
  limit?: number;
}): ReferenceLibraryPage {
  const { filters, offset = 0, limit = PAGE_SIZE } = params;
  const filtered = ENTRIES.filter((e) => {
    if (filters?.category && e.category !== filters.category) return false;
    if (filters?.market && e.market !== filters.market) return false;
    if (filters?.hook && e.hook !== filters.hook) return false;
    return true;
  });
  return {
    cards: filtered.slice(offset, offset + limit).map(toCard),
    total: filtered.length,
  };
}

export function getReferenceLibraryEntry(id: string): ReferenceLibraryEntry | null {
  return BY_ID.get(id) ?? null;
}

export function listReferenceLibraryCategories(): string[] {
  return [...new Set(ENTRIES.map((e) => e.category))].sort();
}

export function listReferenceLibraryMarkets(): string[] {
  return [...new Set(ENTRIES.map((e) => e.market))].sort();
}
