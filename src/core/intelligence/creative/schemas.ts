import { z } from "zod";
import { EvidencedClaimSchema, type EvidencedClaim } from "../../../types/evidence";
import { CONTENT_FORMATS } from "../../../types/taxonomy";

/**
 * Creative Pattern = intenção criativa de alto nível ("por que este vídeo
 * existe"). Fechado e editável, mesmo espírito de CONTENT_FORMATS —
 * cresce só por evidência de uso, nunca por especulação.
 * NÃO confundir com Format (linguagem/tipo de conteúdo, já existe em
 * taxonomy.ts) nem com Visual Mechanic (a ação concreta, abaixo).
 */
export const CREATIVE_PATTERNS = [
  "prove_the_product",
  "discovery",
  "reveal",
  "transformation",
  "demonstration",
  "problem_solution",
  "curiosity",
  "comparison",
  "unboxing",
  "first_use",
  "reaction",
  "social_proof",
  "before_after",
] as const;
export const CreativePatternSchema = z.enum(CREATIVE_PATTERNS);
export type CreativePattern = z.infer<typeof CreativePatternSchema>;

/**
 * Visual Mechanic = a ação visual concreta que comunica o Creative Pattern.
 * Conjunto inicial pequeno (cobre os casos de teste desta fase) — cresce
 * por evidência de uso real, nunca a lista inteira do brainstorm de uma vez.
 */
export const VISUAL_MECHANICS = [
  "unboxing",
  "product_rotation",
  "detail_reveal",
  "functional_demo",
  "before_after",
  "pour",
  "open_close",
  "hand_feel",
  "try_on",
  "comparison",
  "pov_use",
  "reaction",
] as const;
export const VisualMechanicSchema = z.enum(VISUAL_MECHANICS);
export type VisualMechanic = z.infer<typeof VisualMechanicSchema>;

/** Shot Pattern = sequência temporal de shots que implementa a mecânica.
 * Contrato de vídeo; pra imagem (media:"image") shots tem length 1. */
export const ShotSchema = z.object({
  index: z.number().int().nonnegative(),
  function: z.string(),
  durationSeconds: z.number().positive(),
  camera: z.string(),
  action: z.string(),
});
export type Shot = z.infer<typeof ShotSchema>;

export const ShotPatternSchema = z.object({
  shots: z.array(ShotSchema).min(1),
  totalDurationSeconds: z.number().positive(),
});
export type ShotPattern = z.infer<typeof ShotPatternSchema>;

/**
 * Director Spec = direção audiovisual, media-agnóstica. Todo campo nullable
 * de propósito — UNKNOWN é um estado válido, nunca inventado.
 */
export const DirectorSpecSchema = z.object({
  framing: z.string().nullable(),
  cameraMovement: z.string().nullable(),
  lighting: z.string().nullable(),
  environment: z.string().nullable(),
  continuityNotes: z.string().nullable(),
});
export type DirectorSpec = z.infer<typeof DirectorSpecSchema>;

/**
 * Product Capability Map — camada de NORMALIZAÇÃO sobre EvidencedClaim,
 * não um contrato paralelo de evidência (EvidencedClaim em types/evidence.ts
 * continua sendo a única fonte canônica). Mapeamento:
 *   kind "fato"         -> confirmed (e também aparece em observed quando a
 *                          fonte for visual, ex. "foto do produto")
 *   kind "inferencia"    -> inferred
 *   kind "sugestao_ia"   -> recommended
 *   kind "desconhecido"  -> unknown
 */
export const ProductCapabilityMapSchema = z.object({
  observed: z.array(EvidencedClaimSchema),
  confirmed: z.array(EvidencedClaimSchema),
  inferred: z.array(EvidencedClaimSchema),
  recommended: z.array(z.string()),
  unknown: z.array(z.string()),
});
export type ProductCapabilityMap = z.infer<typeof ProductCapabilityMapSchema>;

/**
 * Constrói o Product Capability Map A PARTIR de EvidencedClaim[] — em
 * código, nunca perguntado ao LLM (mesmo princípio de `classify.ts`
 * setando `derivedFromReference` em código: campos estruturais não são
 * confiados à geração). `EvidencedClaim` continua a única fonte canônica;
 * isto é só a projeção/normalização pro vocabulário OBSERVED/CONFIRMED/
 * INFERRED/RECOMMENDED/UNKNOWN pedido.
 */
export function buildProductCapabilityMap(claims: EvidencedClaim[]): ProductCapabilityMap {
  const confirmed = claims.filter((c) => c.kind === "fato");
  const inferred = claims.filter((c) => c.kind === "inferencia");
  const recommended = claims.filter((c) => c.kind === "sugestao_ia").map((c) => c.text);
  const unknown = claims.filter((c) => c.kind === "desconhecido").map((c) => c.text);
  const observed = confirmed.filter((c) => /foto|imagem|v[íi]deo/i.test(c.source));
  return { observed, confirmed, inferred, recommended, unknown };
}

/** Image Spec — composição/enquadramento estruturados, nunca texto livre
 * solto onde um campo estruturado já basta. */
export const ImageSpecSchema = z.object({
  composition: z.string().nullable(),
  subjectPlacement: z.string().nullable(),
  depthOfField: z.string().nullable(),
  aspectRatio: z.string().nullable(),
});
export type ImageSpec = z.infer<typeof ImageSpecSchema>;

/** Video Spec — o que é específico de vídeo além do Shot Pattern (já
 * carregado em CreativeSpec.shotPattern). */
export const VideoSpecSchema = z.object({
  aspectRatio: z.string().nullable(),
  durationSeconds: z.number().positive().nullable(),
});
export type VideoSpec = z.infer<typeof VideoSpecSchema>;

/** Dialogue Spec — contrato mínimo, nunca inventa fala. Nesta fase só
 * existe pra manter a arquitetura extensível (item 10 do adendo final);
 * análise de áudio de referência é trabalho futuro. */
export const DialogueSpecSchema = z.object({
  hasDialogue: z.boolean(),
  lines: z.array(z.string()).nullable(),
  ambientSoundNotes: z.string().nullable(),
});
export type DialogueSpec = z.infer<typeof DialogueSpecSchema>;

/**
 * Creative Spec — o contrato universal. Media-agnóstico: um único cérebro,
 * ImageSpec/VideoSpec como extensões opcionais do mesmo objeto (nunca dois
 * schemas raiz separados). characterConsistency/brandConstraints existem
 * só como contrato nesta fase (item 11 do adendo final) — nenhuma lógica
 * de consistência real implementada ainda.
 */
export const CreativeSpecSchema = z.object({
  version: z.literal("v1"),
  media: z.enum(["image", "video"]),
  format: z.enum(CONTENT_FORMATS),
  pattern: CreativePatternSchema,
  mechanic: VisualMechanicSchema,
  /** Nullable — shots são um conceito de VÍDEO (sequência temporal).
   * Imagem não tem "duração de shot"; forçar a LLM a inventar um sempre
   * produzia lixo real (ex.: durationSeconds:0.03, "camera: static" sem
   * sentido pra uma foto estática) — achado de auditoria, corrigido
   * tornando o campo null quando media==="image", mesmo padrão já usado
   * em imageSpec/videoSpec/dialogueSpec. */
  shotPattern: ShotPatternSchema.nullable(),
  directorSpec: DirectorSpecSchema,
  productTruth: ProductCapabilityMapSchema,
  imageSpec: ImageSpecSchema.nullable(),
  videoSpec: VideoSpecSchema.nullable(),
  dialogueSpec: DialogueSpecSchema.nullable(),
  characterConsistency: z.string().nullable(),
  brandConstraints: z.string().nullable(),
  reasoning: z.string(),
});
export type CreativeSpec = z.infer<typeof CreativeSpecSchema>;

/**
 * Target = model (gerador subjacente, ex. Veo/Kling) ou platform (workflow
 * sobre um ou mais models, ex. Flow sobre Veo). NUNCA misturar os dois —
 * ver ARCHITECTURE.md / plano desta feature para a distinção verificada.
 */
export const TargetKindSchema = z.enum(["model", "platform"]);
export type TargetKind = z.infer<typeof TargetKindSchema>;

export const CapabilityStatusSchema = z.enum(["supported", "unsupported", "unknown"]);
export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>;

export const TargetStatusSchema = z.enum(["active", "beta", "deprecated", "unavailable", "unknown"]);
export type TargetStatus = z.infer<typeof TargetStatusSchema>;

/** Como o Target Specialist deste target é implementado — nunca assumido
 * global; cada target documenta o próprio (item 4 do adendo final). */
export const SpecialistImplementationSchema = z.enum(["deterministic", "llm", "hybrid"]);
export type SpecialistImplementation = z.infer<typeof SpecialistImplementationSchema>;

export const TargetProfileSchema = z.object({
  id: z.string(),
  kind: TargetKindSchema,
  name: z.string(),
  /** Só relevante quando kind === "platform" — em cima de quais models a
   * plataforma roda (ex. Flow -> ["veo"]). */
  basedOn: z.array(z.string()).nullable(),
  capabilities: z.record(z.string(), CapabilityStatusSchema),
  /** Preparado pro AUTOMATIC_TARGET_SELECTION futuro (capability matching +
   * ranking) — sem lógica de ranking rodando nesta fase. */
  requiredCapabilities: z.array(z.string()).nullable(),
  specialistImplementation: SpecialistImplementationSchema,
  source: z.string(),
  lastVerified: z.string(),
  status: TargetStatusSchema,
});
export type TargetProfile = z.infer<typeof TargetProfileSchema>;

/**
 * Como o target foi escolhido:
 *   - user_selected: usuário escolheu um targetId explícito.
 *   - automatic_target_selection: ranking real por capability matching
 *     (Fase 2 — ver target-resolver.ts) escolheu um target diferente do
 *     default porque ele tem uma capability VERIFICADA ("supported") que
 *     o spec exige e o default não tem confirmada. Nunca disparado só
 *     porque "parece melhor" — só quando há diferenciação real de
 *     capability comprovada por fonte (TargetProfile.source/lastVerified).
 *   - default_target: fallback fixo quando não há seleção do usuário NEM
 *     diferenciação real de capability — nunca apresentado como
 *     "automático inteligente" na UI/copy quando é só o fallback puro.
 */
export const TargetSelectionModeSchema = z.enum(["user_selected", "automatic_target_selection", "default_target"]);
export type TargetSelectionMode = z.infer<typeof TargetSelectionModeSchema>;

/** Creative Evaluation avalia a CreativeSpec (a intenção) — ANTES do
 * compile. Distinto de QcResult, que avalia o PROMPT FINAL (depois do
 * compile). Não é um agente LLM novo: reaproveita o reasoning já feito em
 * reasoning.ts + regras determinísticas. */
export const CreativeEvaluationSchema = z.object({
  coherent: z.boolean(),
  mechanicFitsPattern: z.boolean(),
  shotSequenceFeasible: z.boolean(),
  productTruthRespected: z.boolean(),
  objectiveFit: z.boolean(),
  verdict: z.enum(["pass", "warning", "fail"]),
  notes: z.array(z.string()),
});
export type CreativeEvaluation = z.infer<typeof CreativeEvaluationSchema>;

/**
 * Semantic Product Truth Validation (Fase 2) — julgamento de LLM sobre se
 * o conteúdo visual (ações dos shots + direção + diálogo) DEMONSTRA uma
 * característica marcada `unknown`, mesmo sem citar o termo literal
 * (paráfrase, eufemismo, ação que implica o resultado). Complementa —
 * NUNCA substitui — o QC determinístico (qc.ts): roda DEPOIS dele, só
 * quando `productTruth.unknown` não está vazio e o determinístico já não
 * rejeitou (controle de custo, ver semantic-truth.ts). O LLM aqui só
 * JULGA; ele nunca decide/altera `productTruth` — isso continua 100% em
 * código, construído a partir de `EvidencedClaim[]` antes desta chamada
 * (`buildProductCapabilityMap`), nunca depois.
 */
export const SemanticTruthCheckSchema = z.object({
  violatesProductTruth: z.boolean(),
  /** Quais das características de `productTruth.unknown` o conteúdo
   * demonstra — subconjunto do array original, nunca um termo novo. */
  violatedProperties: z.array(z.string()),
  explanation: z.string(),
});
export type SemanticTruthCheck = z.infer<typeof SemanticTruthCheckSchema>;

/** Teto de repair automático — mesma semântica de MAX_AUTO_COMPLIANCE_ATTEMPTS
 * em types/compliance.ts: depois disso, revisão manual explícita, nunca um
 * "pass" mascarado. */
export const CREATIVE_QC_MAX_ATTEMPTS = 2;

/** Prompt QC — avalia o PROMPT COMPILADO (depois do compile). Nunca deve
 * ser confundido com CreativeEvaluation (que avalia a spec, antes). */
export const QcStateSchema = z.enum(["pass", "warning", "fail", "repair_required"]);
export type QcState = z.infer<typeof QcStateSchema>;

export const QcResultSchema = z.object({
  state: QcStateSchema,
  issues: z.array(z.string()),
});
export type QcResult = z.infer<typeof QcResultSchema>;

export const PromptArtifactSchema = z.object({
  id: z.string(),
  version: z.literal("v1"),
  specVersion: z.literal("v1"),
  targetId: z.string(),
  targetKind: TargetKindSchema,
  /** Transparência honesta de como o target foi escolhido — a UI nunca
   * pode rotular `default_target` como "automático inteligente". */
  targetSelectionMode: TargetSelectionModeSchema,
  promptText: z.string(),
  negativePrompt: z.string().nullable(),
  qc: QcResultSchema,
  /** "manual_review_required" quando o repair esgota o teto sem passar no
   * QC — nunca um estado "pass" mascarado (item 8 do adendo final). */
  status: z.enum(["ready", "manual_review_required"]),
});
export type PromptArtifact = z.infer<typeof PromptArtifactSchema>;
