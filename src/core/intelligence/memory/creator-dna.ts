import { listHistory, type HistoryEntry } from "../../../lib/supabase";
import type { ContentFormat, HookType, PersuasionMechanism } from "../../../types/taxonomy";

/**
 * Creator DNA — padrões observáveis derivados do histórico já existente
 * (`creator_history`). Transformação determinística, sem LLM, sem tabela
 * nova: `creator_history.output` já guarda tudo que precisamos (o
 * PipelineOutput inteiro de cada geração aprovada).
 */
export interface CreatorDna {
  totalContents: number;
  formatCounts: Partial<Record<ContentFormat, number>>;
  hookTypeCounts: Partial<Record<HookType, number>>;
  persuasionCounts: Partial<Record<PersuasionMechanism, number>>;
  objectiveCounts: Record<string, number>;
  /** Últimos temas, mais recente primeiro — é isso que alimenta a
   * anti-repetição no prompt do Opportunity Engine (sem embeddings: o
   * volume de um criador não justifica pgvector ainda — ver auditoria). */
  recentThemes: { theme: string; format: string; createdAt: string }[];
}

function countBy<T extends string>(items: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

export function computeCreatorDna(history: HistoryEntry[]): CreatorDna {
  const formats = history.map((h) => h.output.recommendation.format);
  const hookTypes = history.map((h) => h.output.classification?.hookType).filter((v): v is HookType => !!v);
  const persuasionMechanisms = history.flatMap((h) => h.output.classification?.persuasionMechanisms ?? []);
  const objectives = history.map((h) => h.output.request.objective);

  return {
    totalContents: history.length,
    formatCounts: countBy(formats),
    hookTypeCounts: countBy(hookTypes),
    persuasionCounts: countBy(persuasionMechanisms),
    objectiveCounts: countBy(objectives),
    recentThemes: history.slice(0, 20).map((h) => ({
      theme: h.theme,
      format: h.format,
      createdAt: h.createdAt,
    })),
  };
}

export async function deriveCreatorDna(): Promise<CreatorDna> {
  const history = await listHistory();
  return computeCreatorDna(history);
}

/** Serializa o DNA como texto simples pro prompt do Opportunity Engine —
 * sem histórico, é só "totalContents: 0" e o LLM trata como criador novo. */
export function creatorDnaToPromptText(dna: CreatorDna): string {
  if (dna.totalContents === 0) {
    return "Criador sem histórico ainda — não há padrão prévio, trate como primeira geração.";
  }
  const topEntries = (counts: Partial<Record<string, number>>) =>
    Object.entries(counts)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([key, count]) => `${key} (${count}x)`)
      .join(", ") || "nenhum registrado";

  const recent = dna.recentThemes.map((t) => `"${t.theme}" (${t.format}, ${t.createdAt.slice(0, 10)})`).join("; ");

  return `Total de conteúdos gerados: ${dna.totalContents}.
Formatos mais usados: ${topEntries(dna.formatCounts)}.
Tipos de hook mais usados (só quando derivado de vídeo de referência): ${topEntries(dna.hookTypeCounts)}.
Mecanismos de persuasão mais usados: ${topEntries(dna.persuasionCounts)}.
Objetivos mais buscados: ${topEntries(dna.objectiveCounts)}.
Últimos temas abordados (mais recente primeiro, use isso pra não repetir): ${recent}.`;
}
