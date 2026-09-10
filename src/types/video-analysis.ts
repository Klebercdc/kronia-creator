import type { ContentFormat, HookType, Pacing, PersuasionMechanism } from "./taxonomy";

/**
 * Saída estruturada da etapa de Ingestão (baseada no Video Analyzer,
 * adaptada). O vídeo vira DADOS, não só transcript + frames soltos —
 * é isso que a Classificação e a Recomendação consomem.
 */
export interface VideoAnalysis {
  sourceUrl?: string;
  durationSeconds: number;

  hook: {
    startSeconds: number;
    endSeconds: number;
    type: HookType;
    /** Verbatim ou paráfrase — "não disponível" se não houver transcript */
    text: string | null;
  };

  format: {
    primary: ContentFormat;
    secondary: ContentFormat | null;
  };

  structure: string[];

  visual: {
    camera: string;
    framing: string;
    cutsPerMinute: number;
  };

  persuasion: PersuasionMechanism[];

  transcriptSource: "captions" | "whisper" | "none";
  framesAnalyzed: number;
}
