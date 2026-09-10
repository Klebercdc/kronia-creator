import { z } from "zod";
import { CONTENT_FORMATS, HOOK_TYPES, PERSUASION_MECHANISMS } from "./taxonomy";

/**
 * Saída estruturada da etapa de Ingestão (baseada no Video Analyzer,
 * adaptada). O vídeo vira DADOS, não só transcript + frames soltos —
 * é isso que a Classificação e a Recomendação consomem.
 */
export const VideoAnalysisSchema = z.object({
  sourceUrl: z.string().url().optional(),
  durationSeconds: z.number().positive(),

  hook: z.object({
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().nonnegative(),
    type: z.enum(HOOK_TYPES),
    /** Verbatim ou paráfrase — null se não houver transcript */
    text: z.string().nullable(),
  }),

  format: z.object({
    primary: z.enum(CONTENT_FORMATS),
    secondary: z.enum(CONTENT_FORMATS).nullable(),
  }),

  structure: z.array(z.string()),

  visual: z.object({
    camera: z.string(),
    framing: z.string(),
    cutsPerMinute: z.number().nonnegative(),
  }),

  persuasion: z.array(z.enum(PERSUASION_MECHANISMS)),

  transcriptSource: z.enum(["captions", "whisper", "none"]),
  framesAnalyzed: z.number().int().nonnegative(),
});
export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;
