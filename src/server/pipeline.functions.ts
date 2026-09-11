import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runPipeline, analyzeReference, ManualEditRequiredError } from "../core/pipeline";
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
  type SavedTheme,
  type HistoryEntry,
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

/**
 * RPC que roda só a Ingestão/Classificação/Recomendação (o pedaço lento do
 * Caminho A — download do vídeo via yt-dlp, ffmpeg, Whisper, visão
 * computacional). Separada de `runContentPipeline` porque as duas juntas
 * numa function só estouravam o timeout de 60s do Vercel (confirmado em
 * produção). O cliente chama esta primeiro e manda o resultado de volta em
 * `runContentPipeline` — reaproveita sem baixar o vídeo de novo.
 */
export const analyzeReferenceVideo = createServerFn({ method: "POST" })
  .validator((data: unknown) => ContentRequestSchema.parse(data))
  .handler(async ({ data }): Promise<ReferenceAnalysis> => analyzeReference(data));

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
