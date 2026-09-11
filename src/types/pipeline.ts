import { z } from "zod";
import { CONTENT_FORMATS, HOOK_TYPES, MODES, OBJECTIVES, PACING, PERSUASION_MECHANISMS, PROJECTS } from "./taxonomy";
import { VideoAnalysisSchema } from "./video-analysis";
import { EvidencedClaimSchema } from "./evidence";
import { ComplianceResultSchema } from "./compliance";

/**
 * Ator/avatar principal recorrente (ex: o "Jesus" usado nos vídeos do Jeová
 * Fala) — características travadas que todo videoPrompt de cena precisa
 * preservar, pra não variar voz/aparência de vídeo pra vídeo.
 */
export const ActorProfileSchema = z.object({
  name: z.string(),
  voiceDescription: z.string(),
  appearanceDescription: z.string(),
});
export type ActorProfile = z.infer<typeof ActorProfileSchema>;

/** Etapa 0 — Entradas. Caminho A (com referência) e B (sem) convergem aqui. */
export const ContentRequestSchema = z.object({
  project: z.enum(PROJECTS),
  objective: z.enum(OBJECTIVES),
  mode: z.enum(MODES),

  productPhotoUrl: z.string().url().nullable(),
  /** Fonte de verdade junto com a foto — nunca inventar além disso */
  productInfo: z.array(EvidencedClaimSchema),

  referenceVideoUrl: z.string().url().nullable(),

  /** Opcional — trava voz/aparência do ator principal em todas as cenas geradas. */
  actorProfile: ActorProfileSchema.nullable(),

  /** Duração total desejada, em segundos — SEMPRE múltiplo de 10 (o Flow gera
   * em blocos fixos de 10s; cada bloco = 1 submissão separada no Flow).
   * null deixa o Roteirista escolher uma duração padrão sensata. */
  targetDurationSeconds: z.number().int().positive().multipleOf(10).nullable(),
});
export type ContentRequest = z.infer<typeof ContentRequestSchema>;

/** Etapa 1 — Ingestão. Só existe quando há vídeo de referência (Caminho A). */
export type IngestionResult = z.infer<typeof VideoAnalysisSchema> | null;

/** Etapa 2 — Classificação. Usa a taxonomia do Content Research OS, estendida. */
export const ClassificationResultSchema = z.object({
  formatPrimary: z.enum(CONTENT_FORMATS),
  formatSecondary: z.enum(CONTENT_FORMATS).nullable(),
  hookType: z.enum(HOOK_TYPES),
  narrativeStructure: z.array(z.string()),
  pacing: z.enum(PACING),
  persuasionMechanisms: z.array(z.enum(PERSUASION_MECHANISMS)),
  /** Presente só quando a classificação veio de um vídeo de referência */
  derivedFromReference: z.boolean(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

/** Etapa 3 — Recomendação. O diferencial central do sistema. */
export const FormatRecommendationSchema = z.object({
  format: z.enum(CONTENT_FORMATS),
  secondaryFormat: z.enum(CONTENT_FORMATS).nullable(),
  /**
   * Heurística de IA, não estatística validada, até existir loop de feedback
   * com performance real publicada. Nunca exibir como percentual ao usuário.
   */
  confidence: z.enum(["alta", "media", "baixa"]),
  reasoning: z.string(),
  alternatives: z.array(z.enum(CONTENT_FORMATS)),
});
export type FormatRecommendation = z.infer<typeof FormatRecommendationSchema>;

/**
 * Regra de precedência: quando há vídeo de referência, o formato extraído
 * na Classificação é a âncora e a Recomendação roda em cima dele com as
 * alternativas; sem referência, a Recomendação decide sozinha a partir de
 * productInfo + objective + mode.
 */
export function resolveRecommendationSource(
  classification: ClassificationResult | null,
): "referencia_ancora" | "modelo_puro" {
  return classification?.derivedFromReference ? "referencia_ancora" : "modelo_puro";
}

/** Etapa 4 — Geração. Roteirista → Teólogo (se project === "jeova_fala") → Persuasão → Cinematográfico. */
export const ScriptSceneSchema = z.object({
  index: z.number().int().nonnegative(),
  role: z.enum(["hook", "problema", "agitacao", "solucao", "cta"]),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().nonnegative(),
  camera: z.string(),
  action: z.string(),
  narration: z.string(),
  /** Legenda/selo na tela — é aqui que vai "#Ad", "Conteúdo gerado por IA", etc. */
  onScreenText: z.string().nullable(),
  /** Prompt pronto pra colar no Flow/Veo pra gerar ESTE clipe — um shot por vez, não o vídeo inteiro. */
  videoPrompt: z.string(),
});
export type ScriptScene = z.infer<typeof ScriptSceneSchema>;

/**
 * Um bloco de exatos 10 segundos, pronto pra colar no Flow numa única
 * geração — o Flow gera em blocos fixos de 10s, então um vídeo de 50s vira
 * 5 flowSegments, cada um submetido separadamente. Uma ou mais "cenas"
 * narrativas (hook/problema/etc) podem caber dentro do mesmo segmento; o
 * videoPrompt do segmento descreve tudo que acontece nesses 10s como uma
 * ação cinematográfica contínua, com cortes/transições internas quando
 * mais de uma cena cabe no bloco.
 */
export const FlowSegmentSchema = z.object({
  index: z.number().int().nonnegative(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  /** Índices das cenas (ScriptScene.index) cobertas por este segmento de 10s. */
  sceneIndexes: z.array(z.number().int().nonnegative()),
  videoPrompt: z.string(),
});
export type FlowSegment = z.infer<typeof FlowSegmentSchema>;

export const GenerationResultSchema = z.object({
  hooks: z.array(z.string()).length(5),
  selectedHook: z.string(),
  scenes: z.array(ScriptSceneSchema),
  /** Preenchido só pelo Cinematográfico, no fim da cadeia — agrupa as cenas
   * em blocos de 10s prontos pro Flow. Vazio [] até lá. */
  flowSegments: z.array(FlowSegmentSchema),
  claims: z.array(EvidencedClaimSchema),
  /** Preenchido de verdade só pelo agente de SEO, no fim da cadeia — os
   * agentes anteriores devem deixar "" / [] (mesmo padrão do rascunho de
   * videoPrompt até o Cinematográfico). */
  caption: z.string(),
  hashtags: z.array(z.string()),
});
export type GenerationResult = z.infer<typeof GenerationResultSchema>;

/** Etapa 5 — Compliance. Gate: aprovado -> entrega; reprovado -> correção -> Compliance de novo. */
export interface PipelineOutput {
  request: ContentRequest;
  ingestion: IngestionResult;
  /** null no Caminho B (sem vídeo de referência) */
  classification: ClassificationResult | null;
  recommendation: FormatRecommendation;
  generation: GenerationResult;
  compliance: z.infer<typeof ComplianceResultSchema>;
}
