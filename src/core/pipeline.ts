import type { ContentRequest, PipelineOutput, ReferenceAnalysis } from "../types/pipeline";
import { MAX_AUTO_COMPLIANCE_ATTEMPTS } from "../types/compliance";
import { ingest } from "./ingestion/ingest";
import { classify } from "./classification/classify";
import { recommend } from "./recommendation/recommend";
import { generate } from "./generation/generate";
import { validateCompliance } from "./compliance/validate";
import { correctForComplianceStructured } from "./compliance/correct";
import { judgeQuality, reviseForQuality } from "./generation/quality-judge";

export class ManualEditRequiredError extends Error {
  constructor(public readonly output: PipelineOutput) {
    super("Compliance reprovou após o teto de correção automática — requer edição manual.");
    this.name = "ManualEditRequiredError";
  }
}

/**
 * Etapas 1-3 isoladas — o pedaço lento do Caminho A (download de vídeo via
 * yt-dlp, ffmpeg, Whisper, visão computacional). Separado de `runPipeline`
 * pra poder rodar numa function própria: somado à cadeia de 6 agentes da
 * Geração, o request inteiro estourava o timeout de 60s do Vercel em
 * produção (confirmado: "Task timed out after 60 seconds").
 */
export async function analyzeReference(request: ContentRequest): Promise<ReferenceAnalysis> {
  const source = request.referenceVideoStoragePath
    ? ({ kind: "upload", storagePath: request.referenceVideoStoragePath } as const)
    : request.referenceVideoUrl
      ? ({ kind: "url", url: request.referenceVideoUrl } as const)
      : null;
  const ingestion = source ? await ingest(source) : null;
  const classification = ingestion ? await classify(ingestion) : null;
  const recommendation = await recommend(request, classification);
  return { ingestion, classification, recommendation };
}

/**
 * Orquestra os dois caminhos:
 *   A) Vídeo de referência  → Ingestão → Classificação → Recomendação → Geração → Compliance
 *   B) Produto + Objetivo   →                             Recomendação → Geração → Compliance
 *
 * `precomputedAnalysis` deixa reaproveitar o resultado de `analyzeReference`
 * já rodado numa chamada anterior (ver server/pipeline.functions.ts) — sem
 * isso, refaz a Ingestão/Classificação/Recomendação aqui mesmo (comportamento
 * original, ainda usado quando não há vídeo de referência).
 *
 * O gate de Compliance corrige até MAX_AUTO_COMPLIANCE_ATTEMPTS vezes e então
 * escala para edição manual — nunca fica em loop.
 */
export async function runPipeline(
  request: ContentRequest,
  precomputedAnalysis?: ReferenceAnalysis,
): Promise<PipelineOutput> {
  const { ingestion, classification, recommendation } = precomputedAnalysis ?? (await analyzeReference(request));

  let generation = await generate(request, recommendation, classification, ingestion);
  let attempt = 0;
  let compliance = await validateCompliance(request, generation, attempt);

  while (!compliance.approved && attempt < MAX_AUTO_COMPLIANCE_ATTEMPTS) {
    attempt += 1;
    generation = await correctForComplianceStructured(generation, compliance.violations);
    compliance = await validateCompliance(request, generation, attempt);
  }

  // Quality Judge Final — avalia o roteiro que REALMENTE vai ser
  // entregue, depois de toda correção de Compliance (que pode melhorar
  // segurança e degradar copy/persuasão/naturalidade ao mesmo tempo).
  // Mesma régua do Judge inicial (generate.ts), 1 revisão no máximo, com
  // reauditoria de Compliance pra nunca trocar segurança por copy melhor.
  const finalJudgment = await judgeQuality(generation);
  if (finalJudgment.verdict === "needs_revision") {
    const revised = await reviseForQuality(generation, finalJudgment.revisionInstruction);
    const recheck = await validateCompliance(request, revised, attempt);
    const safeToUseRevision = compliance.approved ? recheck.approved : true;
    if (safeToUseRevision) {
      generation = revised;
      compliance = recheck;
    }
  }

  const output: PipelineOutput = {
    request,
    ingestion,
    classification,
    recommendation,
    generation,
    compliance,
  };

  if (!compliance.approved) {
    throw new ManualEditRequiredError(output);
  }

  return output;
}
