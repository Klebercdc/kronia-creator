import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeReferenceAsset } from "../core/reference-studio";
import { ReferenceStudioInputSchema } from "../types/reference-studio";
import { VideoAnalysisSchema } from "../types/video-analysis";

const AnalyzeReferenceAssetInputSchema = z.object({
  input: ReferenceStudioInputSchema,
  imageDataUrls: z.array(z.string().min(1)).optional(),
  videoAnalysis: VideoAnalysisSchema.nullable().optional(),
});

/**
 * Analisa uma referência e devolve o ativo estruturado para revisão.
 * Persistência/versionamento entram em uma etapa separada depois da inspeção
 * do schema real do Supabase; esta função não grava nada por conta própria.
 */
export const analyzeReferenceAssetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => AnalyzeReferenceAssetInputSchema.parse(data))
  .handler(async ({ data }) =>
    analyzeReferenceAsset({
      input: data.input,
      imageDataUrls: data.imageDataUrls,
      videoAnalysis: data.videoAnalysis,
    }),
  );
