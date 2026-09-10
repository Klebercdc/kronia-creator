import type { ContentRequest, PipelineOutput } from "../types/pipeline";
import { MAX_AUTO_COMPLIANCE_ATTEMPTS } from "../types/compliance";
import { ingest } from "./ingestion/ingest";
import { classify } from "./classification/classify";
import { recommend } from "./recommendation/recommend";
import { generate } from "./generation/generate";
import { validateCompliance } from "./compliance/validate";
import { correctForCompliance } from "./compliance/correct";

export class ManualEditRequiredError extends Error {
  constructor(public readonly output: PipelineOutput) {
    super("Compliance reprovou após o teto de correção automática — requer edição manual.");
    this.name = "ManualEditRequiredError";
  }
}

/**
 * Orquestra os dois caminhos:
 *   A) Vídeo de referência  → Ingestão → Classificação → Recomendação → Geração → Compliance
 *   B) Produto + Objetivo   →                             Recomendação → Geração → Compliance
 *
 * O gate de Compliance corrige até MAX_AUTO_COMPLIANCE_ATTEMPTS vezes e então
 * escala para edição manual — nunca fica em loop.
 */
export async function runPipeline(request: ContentRequest): Promise<PipelineOutput> {
  const ingestion = request.referenceVideoUrl ? await ingest(request.referenceVideoUrl) : null;
  const classification = ingestion ? await classify(ingestion) : null;
  const recommendation = await recommend(request, classification);

  let generation = await generate(request, recommendation, classification, ingestion);
  let attempt = 0;
  let compliance = await validateCompliance(request, generation, attempt);

  while (!compliance.approved && attempt < MAX_AUTO_COMPLIANCE_ATTEMPTS) {
    attempt += 1;
    generation = await correctForCompliance(generation, compliance.violations);
    compliance = await validateCompliance(request, generation, attempt);
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
