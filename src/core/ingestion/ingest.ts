import { rm } from "node:fs/promises";
import { join } from "node:path";
import { VideoAnalysisSchema, type VideoAnalysis } from "../../types/video-analysis";
import { downloadVideo } from "./download";
import { probeVideo, extractFrames, sampleFrames } from "./frames";
import { parseVtt, type TranscriptSegment } from "./transcribe";
import { transcribeWithWhisper } from "./whisper";
import { analyzeFrames } from "./analyze";

interface TranscriptResult {
  transcript: TranscriptSegment[];
  source: VideoAnalysis["transcriptSource"];
}

/** Teto de frames mandados pro modelo de visão — controla custo da chamada paga. */
const MAX_FRAMES_FOR_VISION = 16;

/**
 * Etapa 1 — Ingestão. Baseado no Video Analyzer:
 * download (yt-dlp) → frames (ffmpeg, fps auto-escalado) → transcript
 * (legendas ou Whisper via Groq, grátis) → análise visual estruturada
 * (OpenAI — a única peça paga do núcleo, reservada pra o que a Groq não cobre).
 */
export async function ingest(referenceVideoUrl: string): Promise<VideoAnalysis> {
  const download = await downloadVideo(referenceVideoUrl);

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
      sourceUrl: referenceVideoUrl,
      framesAnalyzed: visionFrames.length,
      transcriptSource,
    });
  } finally {
    await rm(download.workDir, { recursive: true, force: true });
  }
}
