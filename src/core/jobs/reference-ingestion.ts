import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  claimJob,
  claimNextJob,
  getJob,
  completeJob,
  advanceJobStep,
  failJobStep,
  downloadReferenceVideoUpload,
  deleteReferenceVideoUpload,
  uploadJobArtifact,
  downloadJobArtifact,
  deleteJobArtifact,
  removeJobArtifacts,
  type JobRow,
} from "../../lib/supabase";
import { probeVideo, extractFrames, sampleFrames } from "../ingestion/frames";
import { extractAudio, transcribeAudioFile } from "../ingestion/whisper";
import { analyzeFrames } from "../ingestion/analyze";
import { classify } from "../classification/classify";
import { recommend } from "../recommendation/recommend";
import { VideoAnalysisSchema } from "../../types/video-analysis";
import type { ContentRequest, ReferenceAnalysis } from "../../types/pipeline";

const MAX_FRAMES_FOR_VISION = 16;

/**
 * Job Engine — Ingestão de vídeo de referência via upload, quebrada em 3
 * steps (download+frames, transcript, visão+classificação+recomendação).
 * Cada step é uma invocação curta, cabe sozinha nos 60s de uma function;
 * `advanceIngestionJob` roda UM step por chamada e devolve o job
 * atualizado — o cliente poll a fila até "succeeded"/"failed".
 */
export async function advanceIngestionJob(jobId: string): Promise<JobRow | null> {
  const job = await claimJob(jobId);
  if (!job) return null; // já em processamento por outro chamador, ou já terminou

  await runStep(job);

  // claimJob só devolve linha quando pega o lock (status "pending" ->
  // "running") — depois de rodar o step o status já mudou de novo, então
  // uma leitura direta (não outro claim) é o jeito certo de devolver o
  // estado atual pro chamador.
  return getJob(jobId);
}

/**
 * Mesma coisa, mas pro worker independente do navegador (pg_cron ->
 * `/api/jobs/worker`) — não sabe qual job id específico processar, só
 * "existe trabalho pendente desse kind". Devolve null quando não há nada
 * pra fazer (fila vazia), o que é o caso normal na maior parte dos polls
 * do cron.
 */
export async function advanceNextPendingJob(kind: string): Promise<JobRow | null> {
  const job = await claimNextJob(kind);
  if (!job) return null;

  await runStep(job);
  return getJob(job.id);
}

async function runStep(job: JobRow): Promise<void> {
  try {
    if (job.step === "download") await stepDownload(job);
    else if (job.step === "transcript") await stepTranscript(job);
    else if (job.step === "vision") await stepVision(job);
    else throw new Error(`Step desconhecido: ${job.step}`);
  } catch (err) {
    const finalStatus = await failJobStep(job, err instanceof Error ? err.message : String(err));
    // Falha definitiva (estourou max_attempts) — ninguém mais vai tocar
    // nesse job, então os artefatos intermediários (e o vídeo original, se
    // a falha foi antes dele ser apagado no step "download") ficariam
    // órfãos no bucket pra sempre sem essa limpeza.
    if (finalStatus === "failed") await cleanupAbandonedArtifacts(job);
  }
}

async function cleanupAbandonedArtifacts(job: JobRow): Promise<void> {
  const prefix = artifactPrefix(job.id);
  await removeJobArtifacts(prefix).catch(() => {});
  await deleteJobArtifact(`${prefix}/audio.mp3`).catch(() => {});
  const payload = job.payload as { storagePath?: string };
  if (payload.storagePath) {
    await deleteReferenceVideoUpload(payload.storagePath).catch(() => {});
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "kronia-job-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function artifactPrefix(jobId: string): string {
  return `jobs/${jobId}`;
}

async function stepDownload(job: JobRow): Promise<void> {
  const { storagePath } = job.payload as { storagePath: string };

  await withTempDir(async (dir) => {
    const buffer = await downloadReferenceVideoUpload(storagePath);
    const videoPath = join(dir, "video.mp4");
    await writeFile(videoPath, Buffer.from(buffer));

    const meta = await probeVideo(videoPath);
    const framesDir = join(dir, "frames");
    await mkdir(framesDir, { recursive: true });
    const allFrames = await extractFrames(videoPath, framesDir, meta.durationSeconds);
    const visionFrames = sampleFrames(allFrames, MAX_FRAMES_FOR_VISION);
    const audioPath = await extractAudio(videoPath, dir);

    const prefix = artifactPrefix(job.id);
    await Promise.all([
      ...visionFrames.map(async (f, i) => {
        const data = await readFile(f.path);
        await uploadJobArtifact(`${prefix}/frames/frame_${i}.jpg`, data, "image/jpeg");
      }),
      (async () => {
        const data = await readFile(audioPath);
        await uploadJobArtifact(`${prefix}/audio.mp3`, data, "audio/mpeg");
      })(),
    ]);

    await deleteReferenceVideoUpload(storagePath);

    await advanceJobStep(job.id, "transcript", {
      durationSeconds: meta.durationSeconds,
      frameTimestamps: visionFrames.map((f) => f.timestampSeconds),
    });
  });
}

async function stepTranscript(job: JobRow): Promise<void> {
  const prefix = artifactPrefix(job.id);

  await withTempDir(async (dir) => {
    const buffer = await downloadJobArtifact(`${prefix}/audio.mp3`);
    const audioPath = join(dir, "audio.mp3");
    await writeFile(audioPath, Buffer.from(buffer));

    const transcript = await transcribeAudioFile(audioPath);
    await deleteJobArtifact(`${prefix}/audio.mp3`);

    await advanceJobStep(job.id, "vision", { ...job.progress, transcript });
  });
}

async function stepVision(job: JobRow): Promise<void> {
  const { request } = job.payload as { request: ContentRequest };
  const progress = job.progress as {
    durationSeconds: number;
    frameTimestamps: number[];
    transcript: { startSeconds: number; endSeconds: number; text: string }[];
  };
  const prefix = artifactPrefix(job.id);

  await withTempDir(async (dir) => {
    const framePaths = await Promise.all(
      progress.frameTimestamps.map(async (_, i) => {
        const buffer = await downloadJobArtifact(`${prefix}/frames/frame_${i}.jpg`);
        const framePath = join(dir, `frame_${i}.jpg`);
        await writeFile(framePath, Buffer.from(buffer));
        return framePath;
      }),
    );

    const analyzed = await analyzeFrames(framePaths, progress.frameTimestamps, progress.transcript, progress.durationSeconds);
    const ingestion = VideoAnalysisSchema.parse({
      ...analyzed,
      framesAnalyzed: framePaths.length,
      transcriptSource: progress.transcript.length ? "whisper" : "none",
    });

    const classification = await classify(ingestion);
    const recommendation = await recommend(request, classification);

    await removeJobArtifacts(prefix);

    const result: ReferenceAnalysis = { ingestion, classification, recommendation };
    await completeJob(job.id, result as unknown as Record<string, unknown>);
  });
}
