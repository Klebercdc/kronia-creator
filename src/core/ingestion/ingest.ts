import { rm } from "node:fs/promises";
import { join } from "node:path";
import { VideoAnalysisSchema, type VideoAnalysis } from "../../types/video-analysis";
import { downloadVideo } from "./download";
import { probeVideo, extractFrames, sampleFrames } from "./frames";
import { parseVtt } from "./transcribe";
import { transcribeWithWhisper } from "./whisper";
import { analyzeFrames } from "./analyze";

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
    const allFrames = await extractFrames(download.videoPath, framesDir, meta.durationSeconds);
    const visionFrames = sampleFrames(allFrames, MAX_FRAMES_FOR_VISION);

    let transcript = download.subtitlePath ? await parseVtt(download.subtitlePath) : [];
    let transcriptSource: VideoAnalysis["transcriptSource"] = transcript.length ? "captions" : "none";

    if (!transcript.length) {
      transcript = await transcribeWithWhisper(download.videoPath, download.workDir);
      transcriptSource = transcript.length ? "whisper" : "none";
    }

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
