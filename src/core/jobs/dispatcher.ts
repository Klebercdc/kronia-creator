import { claimJob, claimNextJob, getJob, failJobStep, type JobRow } from "../../lib/supabase";
import { referenceIngestionHandlers } from "./reference-ingestion";
import { contentGenerationHandlers } from "./content-generation";

export interface JobKindHandlers {
  steps: Record<string, (job: JobRow) => Promise<void>>;
  /** Roda só quando o job falha definitivamente (estourou max_attempts) —
   * é onde cada kind limpa o que só ele sabe que precisa limpar (ex:
   * artefatos no Storage). Opcional pra kinds que não têm nada pra limpar. */
  onPermanentFailure?: (job: JobRow) => Promise<void>;
}

/**
 * Registro de handlers por `kind` — mecanismo genérico do Job Engine
 * (claim/lease/retry/cleanup, em lib/supabase.ts) nunca muda quando um
 * kind novo é adicionado; só se registra aqui. `ingest_reference_video`
 * (download+frames/transcript/visão) e `generate_content` (Recomendação→
 * Geração→Compliance, ver content-generation.ts) passam pela fila porque
 * são cadeias longas de LLM que estouram o timeout de uma function.
 * Trend Interpreter e Opportunity Engine continuam síncronos
 * (createServerFn comum), porque são 1 chamada LLM rápida só (ver
 * ARCHITECTURE.md).
 */
const registry: Record<string, JobKindHandlers> = {
  ingest_reference_video: referenceIngestionHandlers,
  generate_content: contentGenerationHandlers,
};

/** Kinds registrados — usado pelo worker independente do navegador
 * (`/api/jobs/worker`) pra avançar o job mais antigo pendente de CADA
 * kind numa mesma invocação do pg_cron, sem precisar saber os nomes de
 * antemão nem duplicar a lista. */
export const JOB_KINDS = Object.keys(registry);

async function runStep(job: JobRow): Promise<void> {
  const handlers = registry[job.kind];
  if (!handlers) {
    await failJobStep(job, `Kind de job desconhecido: "${job.kind}"`);
    return;
  }
  const step = handlers.steps[job.step];
  if (!step) {
    await failJobStep(job, `Step desconhecido pro kind "${job.kind}": "${job.step}"`);
    return;
  }

  try {
    await step(job);
  } catch (err) {
    const finalStatus = await failJobStep(job, err instanceof Error ? err.message : String(err));
    if (finalStatus === "failed" && handlers.onPermanentFailure) {
      await handlers.onPermanentFailure(job);
    }
  }
}

/** Avança um job específico — usado pelo polling do navegador (rápido,
 * mas só avança com a aba aberta). */
export async function advanceJob(jobId: string): Promise<JobRow | null> {
  const job = await claimJob(jobId);
  if (!job) return null; // já em processamento por outro chamador, ou já terminou

  await runStep(job);

  // claimJob só devolve linha quando pega o lock — depois de rodar o step
  // o status já mudou de novo, então uma leitura direta é o jeito certo
  // de devolver o estado atual pro chamador.
  return getJob(jobId);
}

/** Avança o job mais antigo pendente de um `kind` — usado pelo worker
 * independente do navegador (pg_cron -> `/api/jobs/worker`), que não sabe
 * qual job id específico processar. Devolve null quando não há nada pra
 * fazer (fila vazia). */
export async function advanceNextPendingJob(kind: string): Promise<JobRow | null> {
  const job = await claimNextJob(kind);
  if (!job) return null;

  await runStep(job);
  return getJob(job.id);
}
