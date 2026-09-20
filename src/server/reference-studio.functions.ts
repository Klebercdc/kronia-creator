import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeReferenceAsset } from "../core/reference-studio";
import { ReferenceStudioInputSchema, ReferenceAssetSchema, type ReferenceAsset } from "../types/reference-studio";
import { VideoAnalysisSchema } from "../types/video-analysis";
import {
  archiveReferenceAsset,
  listReferenceAssets,
  lockReferenceAsset,
  saveReferenceAsset,
} from "../lib/supabase";

const AnalyzeReferenceAssetInputSchema = z.object({
  input: ReferenceStudioInputSchema,
  imageDataUrls: z.array(z.string().min(1)).max(8).optional(),
  videoAnalysis: VideoAnalysisSchema.nullable().optional(),
});

export const analyzeReferenceAssetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => AnalyzeReferenceAssetInputSchema.parse(data))
  .handler(async ({ data }): Promise<ReferenceAsset> => {
    const asset = await analyzeReferenceAsset({
      input: data.input,
      imageDataUrls: data.imageDataUrls,
      videoAnalysis: data.videoAnalysis,
    });
    return saveReferenceAsset(asset);
  });

export const listReferenceAssetsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<ReferenceAsset[]> => listReferenceAssets());

export const lockReferenceAssetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    id: z.string().uuid(),
    enabledLockIds: z.array(z.string().min(1)),
  }).parse(data))
  .handler(async ({ data }): Promise<ReferenceAsset> =>
    ReferenceAssetSchema.parse(await lockReferenceAsset(data.id, data.enabledLockIds)),
  );

export const archiveReferenceAssetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<void> => archiveReferenceAsset(data.id));
