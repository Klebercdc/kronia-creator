import type { VideoAnalysis } from "../../types/video-analysis";

/**
 * Etapa 1 — Ingestão. AINDA NÃO IMPLEMENTADA.
 *
 * Baseia-se no Video Analyzer (download via yt-dlp, frames via ffmpeg com
 * fps auto-escalado, transcript via legendas/Whisper, leitura de frames por
 * visão multimodal) — é um pipeline separado, hoje em Python, que precisa
 * ser portado ou chamado como serviço a partir daqui. Ver src/core/ingestion/README.md.
 *
 * Por enquanto lança erro explícito em vez de fingir que funciona — melhor
 * um erro claro no Caminho A do que um resultado inventado.
 */
export async function ingest(referenceVideoUrl: string): Promise<VideoAnalysis> {
  throw new Error(
    `Ingestão de vídeo ainda não implementada (recebido: ${referenceVideoUrl}). ` +
      "Portar o pipeline do Video Analyzer (download/frames/transcript) antes de usar o Caminho A.",
  );
}
