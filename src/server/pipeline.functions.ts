import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runPipeline, ManualEditRequiredError } from "../core/pipeline";
import { analyzeActorImage } from "../core/generation/actor-vision";
import { ContentRequestSchema, type PipelineOutput } from "../types/pipeline";

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
