import { rm } from "node:fs/promises";
import { join } from "node:path";
import { VideoAnalysisSchema, type VideoAnalysis } from "../../types/video-analysis";
import { downloadVideo } from "./download";
import { downloadFromStorage } from "./storage-download";
import { probeVideo, extractFrames, sampleFrames } from "./frames";
import { parseVtt, type TranscriptSegment } from "./transcribe";
import { transcribeWithWhisper } from "./whisper";
import { analyzeFrames } from "./analyze";
import { deleteReferenceVideoUpload } from "../../lib/supabase";

interface TranscriptResult {
  transcript: TranscriptSegment[];
  source: VideoAnalysis["transcriptSource"];
}

/** Duas formas de chegar num vídeo de referência: link direto (yt-dlp) ou
 * upload feito pelo usuário (fallback quando o link não funciona — ex:
 * gravação de tela), já salvo no Supabase Storage pelo navegador. */
export type ReferenceVideoSource = { kind: "url"; url: string } | { kind: "upload"; storagePath: string };

/** Teto de frames mandados pro modelo de visão — controla custo da chamada paga. */
const MAX_FRAMES_FOR_VISION = 16;

/**
 * Etapa 1 — Ingestão. Baseado no Video Analyzer:
 * download (yt-dlp ou upload) → frames (ffmpeg, fps auto-escalado) →
 * transcript (legendas ou Whisper via Groq, grátis) → análise visual
 * estruturada (OpenAI — a única peça paga do núcleo, reservada pra o que a
 * Groq não cobre).
 */
export async function ingest(source: ReferenceVideoSource): Promise<VideoAnalysis> {
  const download = source.kind === "url" ? await downloadVideo(source.url) : await downloadFromStorage(source.storagePath);

  try {
    const meta = await probeVideo(download.videoPath);
    const framesDir = join(download.workDir, "frames");

    // Extração de frames e obtenção do transcript não dependem uma da
    // outra (só do download) — rodar em paralelo economiza os vários
    // segundos do ffmpeg de frames enquanto o Whisper transcreve (contra
    // o teto de 60s do Vercel Hobby, que já estourou em produção).
    const [allFrames, transcriptResult] = await Promise.all([
      extractFrames(download.videoPath, framesDir, meta.durationSeconds),
      (async (): Promise<TranscriptResult> => {
        if (download.subtitlePath) {
          const transcript = await parseVtt(download.subtitlePath);
          return { transcript, source: transcript.length ? "captions" : "none" };
        }
        const transcript = await transcribeWithWhisper(download.videoPath, download.workDir);
        return { transcript, source: transcript.length ? "whisper" : "none" };
      })(),
    ]);
    const visionFrames = sampleFrames(allFrames, MAX_FRAMES_FOR_VISION);
    const transcript = transcriptResult.transcript;
    const transcriptSource = transcriptResult.source;

    const analysis = await analyzeFrames(
      visionFrames.map((f) => f.path),
      visionFrames.map((f) => f.timestampSeconds),
      transcript,
      meta.durationSeconds,
    );

    return VideoAnalysisSchema.parse({
      ...analysis,
      sourceUrl: source.kind === "url" ? source.url : undefined,
      framesAnalyzed: visionFrames.length,
      transcriptSource,
    });
  } finally {
    await rm(download.workDir, { recursive: true, force: true });
    if (source.kind === "upload") {
      // Best-effort — não deixa o objeto pra sempre no bucket, mas também
      // não derruba a Ingestão se a limpeza falhar (já processamos o dado).
      await deleteReferenceVideoUpload(source.storagePath).catch(() => {});
    }
  }
}
