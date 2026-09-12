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

  /** Fotos do produto (frente, verso, rótulo etc.) — todas analisadas juntas
   * numa chamada de visão só (product-vision.ts). */
  productPhotoUrls: z.array(z.string().url()),
  /** Fonte de verdade junto com a foto — nunca inventar além disso */
  productInfo: z.array(EvidencedClaimSchema),

  referenceVideoUrl: z.string().url().nullable(),
  /** Alternativa ao link — vídeo que o usuário enviou direto (ex: gravação
   * de tela, quando o download via link não funciona). Path dentro do
   * bucket `creator-reference-videos` no Supabase Storage, já uploadado
   * pelo navegador antes desta chamada. Tem precedência sobre
   * `referenceVideoUrl` quando os dois vêm preenchidos. */
  referenceVideoStoragePath: z.string().nullable(),

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
/** Gesto amarrado a uma palavra/trecho específico da fala — nunca
 * "gesticula naturalmente" solto (ver Voice & Performance em
 * cinematografico.ts). */
export const GestureMapEntrySchema = z.object({
  trigger: z.string(),
  gesture: z.string(),
});
export type GestureMapEntry = z.infer<typeof GestureMapEntrySchema>;

export const FlowSegmentSchema = z.object({
  index: z.number().int().nonnegative(),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  /** Índices das cenas (ScriptScene.index) cobertas por este segmento de 10s. */
  sceneIndexes: z.array(z.number().int().nonnegative()),
  videoPrompt: z.string(),
  /** Olhar como camada dirigível própria — intensidade/foco em função do
   * que está sendo dito, separado da câmera e da ação física. */
  gaze: z.string(),
  /** Gesto amarrado a palavra específica da fala deste bloco. */
  gestureMap: z.array(GestureMapEntrySchema),
  voiceTimbre: z.string(),
  interpretationMode: z.string(),
  /** Obrigatório (não-null) quando a duração total do roteiro for múltiplo
   * de 30s — bloco 1 = gancho, bloco(s) do meio = desenvolvimento, bloco
   * final = cta. Fora desse caso, pode ficar null (estrutura não se aplica
   * de forma limpa a qualquer duração). */
  narrativeFunction: z.enum(["gancho", "desenvolvimento", "cta"]).nullable(),
});
export type FlowSegment = z.infer<typeof FlowSegmentSchema>;

/** Creative Context / DecisionLog — cada agente da cadeia ACRESCENTA 1
 * entrada ao final, nunca apaga/reescreve entrada de outro agente. O
 * "motivo" vem da PRÓPRIA chamada à OpenAI daquele agente (campo
 * `motivoDecisao` pedido junto com o resultado principal, nunca um
 * resumo escrito depois por fora) — é o que deixa o próximo agente da
 * cadeia (ex: Marketing) ler POR QUE o anterior (ex: Roteirista) decidiu
 * daquele jeito antes de decidir mudar ou manter. */
export const DecisionLogEntrySchema = z.object({
  agente: z.string(),
  decisao: z.string(),
  motivo: z.string(),
  alternativasDescartadas: z.array(z.string()).optional(),
});
export type DecisionLogEntry = z.infer<typeof DecisionLogEntrySchema>;

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
  decisionLog: z.array(DecisionLogEntrySchema),
});
export type GenerationResult = z.infer<typeof GenerationResultSchema>;

/**
 * Saída das etapas 1-3 (Ingestão + Classificação + Recomendação) —
 * exatamente o pedaço lento do Caminho A (download de vídeo, ffmpeg,
 * Whisper, visão computacional). Devolvida ao cliente numa chamada própria
 * (`analyzeReferenceVideo`) pra a chamada de geração não precisar refazer
 * esse trabalho nem correr o risco de estourar o timeout da function
 * somando as duas coisas numa só (é dado pequeno — não guarda o vídeo em
 * si, que já é descartado ao fim da Ingestão).
 */
export const ReferenceAnalysisSchema = z.object({
  ingestion: VideoAnalysisSchema.nullable(),
  classification: ClassificationResultSchema.nullable(),
  recommendation: FormatRecommendationSchema,
});
export type ReferenceAnalysis = z.infer<typeof ReferenceAnalysisSchema>;

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
