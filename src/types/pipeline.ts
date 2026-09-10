import type { ContentFormat, HookType, Mode, Objective, PersuasionMechanism, Project } from "./taxonomy";
import type { VideoAnalysis } from "./video-analysis";
import type { EvidencedClaim } from "./evidence";
import type { ComplianceResult } from "./compliance";

/** Etapa 0 — Entradas. Caminho A (com referência) e B (sem) convergem aqui. */
export interface ContentRequest {
  project: Project;
  objective: Objective;
  mode: Mode;

  productPhotoUrl: string | null;
  /** Fonte de verdade junto com a foto — nunca inventar além disso */
  productInfo: EvidencedClaim[];

  referenceVideoUrl: string | null;
}

/** Etapa 1 — Ingestão. Só existe quando há vídeo de referência (Caminho A). */
export type IngestionResult = VideoAnalysis | null;

/** Etapa 2 — Classificação. Usa a taxonomia do Content Research OS, estendida. */
export interface ClassificationResult {
  formatPrimary: ContentFormat;
  formatSecondary: ContentFormat | null;
  hookType: HookType;
  narrativeStructure: string[];
  pacing: "lento" | "medio" | "rapido";
  persuasionMechanisms: PersuasionMechanism[];
  /** Presente só quando a classificação veio de um vídeo de referência */
  derivedFromReference: boolean;
}

/** Etapa 3 — Recomendação. O diferencial central do sistema. */
export interface FormatRecommendation {
  format: ContentFormat;
  secondaryFormat: ContentFormat | null;
  /**
   * Heurística de IA, não estatística validada, até existir loop de feedback
   * com performance real publicada. Nunca exibir como percentual ao usuário.
   */
  confidence: "alta" | "media" | "baixa";
  reasoning: string;
  alternatives: ContentFormat[];
}

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
export interface ScriptScene {
  index: number;
  role: "hook" | "problema" | "agitacao" | "solucao" | "cta";
  startSeconds: number;
  endSeconds: number;
  camera: string;
  action: string;
  narration: string;
}

export interface GenerationResult {
  hooks: string[]; // 5 opções
  selectedHook: string;
  scenes: ScriptScene[];
  videoPrompt: string;
  claims: EvidencedClaim[];
}

/** Etapa 5 — Compliance. Gate: aprovado -> entrega; reprovado -> correção -> Compliance de novo. */
export interface PipelineOutput {
  request: ContentRequest;
  ingestion: IngestionResult;
  classification: ClassificationResult;
  recommendation: FormatRecommendation;
  generation: GenerationResult;
  compliance: ComplianceResult;
  estimatedCreditsForVideo: number;
}
