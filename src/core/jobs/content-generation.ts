import { advanceJobStep, completeJob, type JobRow } from "../../lib/supabase";
import { recommend } from "../recommendation/recommend";
import { roteirista } from "../generation/roteirista";
import { marketing } from "../generation/marketing";
import { teologo } from "../generation/teologo";
import { psicologiaDeCompra } from "../generation/psicologia-compra";
import { persuasao } from "../generation/persuasao";
import { cinematografico } from "../generation/cinematografico";
import { judgeQuality, reviseForQuality } from "../generation/quality-judge";
import { validateCompliance } from "../compliance/validate";
import { correctForCompliance } from "../compliance/correct";
import { MAX_AUTO_COMPLIANCE_ATTEMPTS } from "../../types/compliance";
import type {
  ClassificationResult,
  ContentRequest,
  FormatRecommendation,
  GenerationResult,
  PipelineOutput,
  ReferenceAnalysis,
} from "../../types/pipeline";
import type { ComplianceViolation } from "../../types/compliance";
import type { VideoAnalysis } from "../../types/video-analysis";
import type { JobKindHandlers } from "./dispatcher";

interface Payload {
  request: ContentRequest;
  precomputedAnalysis?: ReferenceAnalysis;
}

interface Progress {
  ingestion: VideoAnalysis | null;
  classification: ClassificationResult | null;
  recommendation: FormatRecommendation | null;
  draft: GenerationResult | null;
  attempt: number;
  violations: ComplianceViolation[];
  qualityInstruction: string | null;
  [key: string]: unknown;
}

/**
 * Geração de conteúdo (Etapas 3-5: Recomendação → Geração → Compliance)
 * como job assíncrono — mesmo padrão do `ingest_reference_video`
 * (reference-ingestion.ts), reaproveitando as MESMAS funções de
 * `core/generation`/`core/compliance`/`core/recommendation` que
 * `core/pipeline.ts` já usa (`generate()`/`runPipeline` continuam
 * existindo, sem duplicar lógica — só a orquestração vira step-a-step em
 * vez de uma cadeia síncrona só).
 *
 * Motivo: a cadeia de 6 agentes de Geração + até 2 rodadas de
 * Compliance (validate+correct) é de 6 a 11 chamadas de LLM em
 * sequência — cabia raspando no timeout de 60s da function em produção
 * (Caminho B, sem vídeo de referência); exatamente o mesmo problema que
 * a Ingestão de vídeo já tinha e que o Job Engine resolveu pra ela.
 *
 * `job.result` final tem o mesmo formato de `RunPipelineResult`
 * (server/pipeline.functions.ts): `{status:"aprovado"|"manual", output}`
 * — nunca lança erro pro chamador marcar como "failed", porque reprovar
 * no Compliance depois do teto é um resultado válido (edição manual),
 * não uma falha de processamento.
 */
export const contentGenerationHandlers: JobKindHandlers = {
  steps: {
    recommend: stepRecommend,
    roteirista: stepRoteirista,
    marketing: stepMarketing,
    teologo: stepTeologo,
    psicologia: stepPsicologia,
    persuasao: stepPersuasao,
    cinematografico: stepCinematografico,
    quality_judge: stepQualityJudge,
    quality_revise: stepQualityRevise,
    compliance_validate: stepComplianceValidate,
    compliance_correct: stepComplianceCorrect,
  },
};

function payloadOf(job: JobRow): Payload {
  return job.payload as unknown as Payload;
}

function progressOf(job: JobRow): Progress {
  return job.progress as unknown as Progress;
}

async function stepRecommend(job: JobRow): Promise<void> {
  const { request, precomputedAnalysis } = payloadOf(job);

  const { ingestion, classification, recommendation } = precomputedAnalysis
    ? precomputedAnalysis
    : { ingestion: null, classification: null, recommendation: await recommend(request, null) };

  const progress: Progress = {
    ingestion,
    classification,
    recommendation,
    draft: null,
    attempt: 0,
    violations: [],
    qualityInstruction: null,
  };
  await advanceJobStep(job.id, "roteirista", progress);
}

async function stepRoteirista(job: JobRow): Promise<void> {
  const { request } = payloadOf(job);
  const progress = progressOf(job);
  const draft = await roteirista(request, progress.recommendation!, progress.classification);
  await advanceJobStep(job.id, "marketing", { ...progress, draft });
}

async function stepMarketing(job: JobRow): Promise<void> {
  const { request } = payloadOf(job);
  const progress = progressOf(job);
  const draft = await marketing(progress.draft!, request, progress.recommendation!);
  const next = request.project === "jeova_fala" ? "teologo" : "psicologia";
  await advanceJobStep(job.id, next, { ...progress, draft });
}

async function stepTeologo(job: JobRow): Promise<void> {
  const progress = progressOf(job);
  const draft = await teologo(progress.draft!);
  await advanceJobStep(job.id, "psicologia", { ...progress, draft });
}

async function stepPsicologia(job: JobRow): Promise<void> {
  const progress = progressOf(job);
  const draft = await psicologiaDeCompra(progress.draft!);
  await advanceJobStep(job.id, "persuasao", { ...progress, draft });
}

async function stepPersuasao(job: JobRow): Promise<void> {
  const progress = progressOf(job);
  const draft = await persuasao(progress.draft!);
  await advanceJobStep(job.id, "cinematografico", { ...progress, draft });
}

async function stepCinematografico(job: JobRow): Promise<void> {
  const { request } = payloadOf(job);
  const progress = progressOf(job);
  const draft = await cinematografico(progress.draft!, request.actorProfile, progress.ingestion);
  await advanceJobStep(job.id, "quality_judge", { ...progress, draft });
}

/** Quality Judge — eixo de qualidade criativa (específico/natural/
 * persuasivo/aderente ao produto), separado do Compliance (risco legal/
 * política) logo depois. 1 revisão direcionada no máximo, nunca um
 * loop — o Compliance já tem o dele. */
async function stepQualityJudge(job: JobRow): Promise<void> {
  const progress = progressOf(job);
  const judgment = await judgeQuality(progress.draft!);

  if (judgment.verdict === "pass") {
    await advanceJobStep(job.id, "compliance_validate", { ...progress, attempt: 0 });
    return;
  }

  await advanceJobStep(job.id, "quality_revise", { ...progress, qualityInstruction: judgment.revisionInstruction });
}

async function stepQualityRevise(job: JobRow): Promise<void> {
  const progress = progressOf(job);
  const draft = await reviseForQuality(progress.draft!, progress.qualityInstruction!);
  await advanceJobStep(job.id, "compliance_validate", { ...progress, draft, attempt: 0 });
}

async function stepComplianceValidate(job: JobRow): Promise<void> {
  const { request } = payloadOf(job);
  const progress = progressOf(job);
  const compliance = await validateCompliance(request, progress.draft!, progress.attempt);

  if (compliance.approved || progress.attempt >= MAX_AUTO_COMPLIANCE_ATTEMPTS) {
    const output: PipelineOutput = {
      request,
      ingestion: progress.ingestion,
      classification: progress.classification,
      recommendation: progress.recommendation!,
      generation: progress.draft!,
      compliance,
    };
    await completeJob(job.id, { status: compliance.approved ? "aprovado" : "manual", output });
    return;
  }

  await advanceJobStep(job.id, "compliance_correct", { ...progress, violations: compliance.violations });
}

async function stepComplianceCorrect(job: JobRow): Promise<void> {
  const progress = progressOf(job);
  const draft = await correctForCompliance(progress.draft!, progress.violations);
  await advanceJobStep(job.id, "compliance_validate", { ...progress, draft, attempt: progress.attempt + 1 });
}
