import { createServerFn } from "@tanstack/react-start";
import { runPipeline, ManualEditRequiredError } from "../core/pipeline";
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
