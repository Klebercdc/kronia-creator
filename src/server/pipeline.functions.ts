import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runPipeline, ManualEditRequiredError } from "../core/pipeline";
import { analyzeActorImage } from "../core/generation/actor-vision";
import { refineScenePrompt } from "../core/generation/refine-scene";
import { seo } from "../core/generation/seo";
import { checkFabricatedNumbers } from "../core/compliance/numeric-guard";
import { checkBannedAbsoluteClaims } from "../core/compliance/absolute-claims-guard";
import { listSavedThemes, addSavedTheme, removeSavedTheme, type SavedTheme } from "../lib/supabase";
import {
  ActorProfileSchema,
  ContentRequestSchema,
  GenerationResultSchema,
  ScriptSceneSchema,
  type GenerationResult,
  type PipelineOutput,
} from "../types/pipeline";
import type { ComplianceViolation } from "../types/compliance";

export type RunPipelineResult =
  | { status: "aprovado"; output: PipelineOutput }
  | { status: "manual"; output: PipelineOutput };

/**
 * RPC chamável do cliente — roda o núcleo inteiro no servidor (onde ficam
 * as chaves de API e as ferramentas de vídeo). O cliente nunca fala direto
 * com Groq/OpenAI/yt-dlp.
 */
export const runContentPipeline = createServerFn({ method: "POST" })
  .validator((data: unknown) => ContentRequestSchema.parse(data))
  .handler(async ({ data }): Promise<RunPipelineResult> => {
    try {
      const output = await runPipeline(data);
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
 * RPC que ajusta o videoPrompt de UMA cena a partir de feedback do usuário
 * (ex: "no Flow a boca não mexeu") — não roda o pipeline inteiro de novo,
 * só o agente Cinematográfico focado nessa cena. Mais rápido e mais barato
 * que clicar em "Criar" de novo pra corrigir um detalhe.
 */
export const refineScene = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        scene: ScriptSceneSchema,
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
