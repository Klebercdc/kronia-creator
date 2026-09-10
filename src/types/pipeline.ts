import { z } from "zod";
import { CONTENT_FORMATS, HOOK_TYPES, MODES, OBJECTIVES, PACING, PERSUASION_MECHANISMS, PROJECTS } from "./taxonomy";
import { VideoAnalysisSchema } from "./video-analysis";
import { EvidencedClaimSchema } from "./evidence";
import { ComplianceResultSchema } from "./compliance";

/** Etapa 0 — Entradas. Caminho A (com referência) e B (sem) convergem aqui. */
export const ContentRequestSchema = z.object({
  project: z.enum(PROJECTS),
  objective: z.enum(OBJECTIVES),
  mode: z.enum(MODES),

  productPhotoUrl: z.string().url().nullable(),
  /** Fonte de verdade junto com a foto — nunca inventar além disso */
  productInfo: z.array(EvidencedClaimSchema),

  referenceVideoUrl: z.string().url().nullable(),
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
});
export type ScriptScene = z.infer<typeof ScriptSceneSchema>;

export const GenerationResultSchema = z.object({
  hooks: z.array(z.string()).length(5),
  selectedHook: z.string(),
  scenes: z.array(ScriptSceneSchema),
  videoPrompt: z.string(),
  claims: z.array(EvidencedClaimSchema),
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
  estimatedCreditsForVideo: number;
}
