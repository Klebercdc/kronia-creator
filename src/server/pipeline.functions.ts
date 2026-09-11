import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runPipeline, ManualEditRequiredError } from "../core/pipeline";
import { advanceIngestionJob as advanceIngestionJobCore } from "../core/jobs/reference-ingestion";
import { analyzeActorImage } from "../core/generation/actor-vision";
import { analyzeProductImage } from "../core/generation/product-vision";
import { refineScenePrompt } from "../core/generation/refine-scene";
import { seo } from "../core/generation/seo";
import { checkFabricatedNumbers } from "../core/compliance/numeric-guard";
import { checkBannedAbsoluteClaims } from "../core/compliance/absolute-claims-guard";
import {
  listSavedThemes,
  addSavedTheme,
  removeSavedTheme,
  addHistoryEntry,
  listHistory,
  removeHistoryEntry,
  createJob,
  getJob as getJobCore,
  type SavedTheme,
  type HistoryEntry,
  type JobStatus,
} from "../lib/supabase";
import {
  ActorProfileSchema,
  ContentRequestSchema,
  FlowSegmentSchema,
  GenerationResultSchema,
  ReferenceAnalysisSchema,
  ScriptSceneSchema,
  type GenerationResult,
  type PipelineOutput,
  type ReferenceAnalysis,
} from "../types/pipeline";
import type { ComplianceViolation } from "../types/compliance";

export type RunPipelineResult =
  | { status: "aprovado"; output: PipelineOutput }
  | { status: "manual"; output: PipelineOutput };

export interface JobStatusResult {
  id: string;
  status: JobStatus;
  step: string;
  /** Progresso semântico (não granular por design) — cada step vale um
   * pedaço fixo, não é % de bytes processados. */
  progressPercent: number;
  error: string | null;
  result: ReferenceAnalysis | null;
}

const STEP_PROGRESS_PERCENT: Record<string, number> = {
  download: 20,
  transcript: 55,
  vision: 85,
};

function progressPercentFor(status: JobStatus, step: string): number {
  if (status === "succeeded") return 100;
  if (status === "failed") return STEP_PROGRESS_PERCENT[step] ?? 0;
  return STEP_PROGRESS_PERCENT[step] ?? 0;
}

/**
 * Job Engine — a Ingestão de vídeo por upload (download+frames, transcrição,
 * visão+classificação+recomendação) é lenta demais pra caber numa function
 * só (confirmado em produção: 60s estourado mesmo depois de separar do
 * resto do pipeline). Em vez disso vira um job em 3 steps persistido no
 * Postgres (Supabase).
 *
 * Duas formas do job avançar (ver core/jobs/reference-ingestion.ts):
 * 1) `advanceIngestionJob` — o polling do próprio navegador, chamado pela
 *    UI enquanto a tela de "Analisando..." está aberta. Rápido (~1.5s por
 *    step), mas só avança com a aba aberta.
 * 2) Um worker de verdade, independente do navegador: pg_cron (Postgres)
 *    chama `/api/jobs/worker` a cada minuto — continua avançando o job
 *    mesmo se a aba fechar. Os dois convergem no mesmo `claim` atômico, só
 *    um processa cada step por vez.
 *
 * `idempotencyKey` = o storagePath do vídeo (já é único por upload, gerado
 * no navegador) — enfileirar duas vezes o mesmo vídeo devolve o job
 * existente em vez de criar um duplicado.
 */
export const enqueueReferenceIngestion = createServerFn({ method: "POST" })
  .validator((data: unknown) => ContentRequestSchema.parse(data))
  .handler(async ({ data }): Promise<{ jobId: string }> => {
    if (!data.referenceVideoStoragePath) {
      throw new Error("referenceVideoStoragePath é obrigatório pra enfileirar a Ingestão.");
    }
    const job = await createJob(
      "ingest_reference_video",
      "download",
      { storagePath: data.referenceVideoStoragePath, request: data },
      `ingest_reference_video:${data.referenceVideoStoragePath}`,
    );
    return { jobId: job.id };
  });

/** Leitura pura do status — não processa nada, só consulta. Existe
 * separada de `advanceIngestionJob` pra deixar claro que consultar
 * progresso e executar trabalho são operações diferentes (mesmo os dois
 * hoje sendo chamados juntos pelo polling da UI). */
export const getIngestionJobStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ jobId: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<JobStatusResult | null> => {
    const job = await getJobCore(data.jobId);
    if (!job) return null;
    return toJobStatusResult(job);
  });

export const advanceIngestionJob = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ jobId: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<JobStatusResult | null> => {
    const job = await advanceIngestionJobCore(data.jobId);
    if (!job) return null;
    return toJobStatusResult(job);
  });

function toJobStatusResult(job: NonNullable<Awaited<ReturnType<typeof advanceIngestionJobCore>>>): JobStatusResult {
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    progressPercent: progressPercentFor(job.status, job.step),
    error: job.error,
    result: job.status === "succeeded" ? (job.result as unknown as ReferenceAnalysis) : null,
  };
}

/**
 * RPC chamável do cliente — roda o núcleo inteiro no servidor (onde ficam
 * as chaves de API e as ferramentas de vídeo). O cliente nunca fala direto
 * com Groq/OpenAI/yt-dlp.
 *
 * `precomputedAnalysis` é o resultado de `analyzeReferenceVideo`, quando o
 * cliente já rodou essa etapa antes (Caminho A) — evita refazer a Ingestão.
 * Sem vídeo de referência (Caminho B) não há nada lento pra separar, então
 * o cliente chama direto sem passar por `analyzeReferenceVideo`.
 */
export const runContentPipeline = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        request: ContentRequestSchema,
        precomputedAnalysis: ReferenceAnalysisSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<RunPipelineResult> => {
    try {
      const output = await runPipeline(data.request, data.precomputedAnalysis);
      return { status: "aprovado", output };
    } catch (err) {
      if (err instanceof ManualEditRequiredError) {
        return { status: "manual", output: err.output };
      }
      throw err;
    }
  });

/**
 * RPC que lê a foto de referência do ator principal e devolve a descrição
 * de aparência extraída da imagem — o usuário revisa/ajusta antes de travar.
 */
export const analyzeActorPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ imageDataUrl: z.string() }).parse(data))
  .handler(async ({ data }): Promise<{ appearanceDescription: string }> => {
    const appearanceDescription = await analyzeActorImage(data.imageDataUrl);
    return { appearanceDescription };
  });

/**
 * RPC que lê a(s) foto(s) do produto e devolve uma descrição visual real
 * extraída delas — vira EvidencedClaim (kind "inferencia") somada ao que o
 * usuário escreveu, em vez de a foto ficar só decorativa na tela. Aceita
 * mais de uma foto (ex: frente, verso, rótulo) — todas analisadas juntas
 * numa chamada só.
 */
export const analyzeProductPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ imageDataUrls: z.array(z.string()).min(1) }).parse(data))
  .handler(async ({ data }): Promise<{ visualDescription: string }> => {
    const visualDescription = await analyzeProductImage(data.imageDataUrls);
    return { visualDescription };
  });

/**
 * RPC que ajusta o videoPrompt de UM segmento de 10s (o bloco que realmente
 * vai pro Flow) a partir de feedback do usuário (ex: "no Flow a boca não
 * mexeu") — não roda o pipeline inteiro de novo, só o agente Cinematográfico
 * focado nesse segmento. Mais rápido e mais barato que clicar em "Criar" de
 * novo pra corrigir um detalhe.
 */
export const refineScene = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        segment: FlowSegmentSchema,
        scenes: z.array(ScriptSceneSchema),
        actorProfile: ActorProfileSchema.nullable(),
        feedback: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ videoPrompt: string }> => {
    const videoPrompt = await refineScenePrompt(data);
    return { videoPrompt };
  });

/**
 * RPC que gera legenda + hashtags SOB DEMANDA (o usuário clica só quando já
 * gostou do roteiro) — a busca de hashtag tem custo, não vale rodar em toda
 * tentativa de regenerar o roteiro. Roda os guards determinísticos
 * (número/frase proibida) na legenda antes de devolver, já que ela nunca
 * passa pelo gate de Compliance automático (que já rodou antes disso existir).
 */
export const generateSeoPackage = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ generation: GenerationResultSchema, request: ContentRequestSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<{ generation: GenerationResult; warnings: ComplianceViolation[] }> => {
    const generation = await seo(data.generation, data.request);
    const warnings = [
      ...checkFabricatedNumbers(generation, data.request.productInfo),
      ...checkBannedAbsoluteClaims(generation),
    ];
    return { generation, warnings };
  });

/** RPCs de temas salvos (Supabase) — lista, adiciona e remove. */
export const listSavedThemesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SavedTheme[]> => listSavedThemes(),
);

export const addSavedThemeFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ text: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<SavedTheme> => addSavedTheme(data.text));

export const removeSavedThemeFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<void> => removeSavedTheme(data.id));

/** RPCs de histórico (Supabase) — salva cada roteiro aprovado, lista e remove. */
export const addHistoryEntryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        project: z.string().min(1),
        format: z.string().min(1),
        theme: z.string(),
        selectedHook: z.string(),
        output: z.custom<PipelineOutput>(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<void> => addHistoryEntry(data));

export const listHistoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HistoryEntry[]> => listHistory(),
);

export const removeHistoryEntryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<void> => removeHistoryEntry(data.id));
