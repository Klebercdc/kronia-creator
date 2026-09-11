import Groq from "groq-sdk";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { getVendoredBinaryPath } from "../../lib/vendored-binary";
import type { TranscriptSegment } from "./transcribe";

const run = promisify(execFile);

/** Extrai áudio mono 16kHz do vídeo — separado de `transcribeAudioFile` pra
 * caber em steps distintos do Job Engine (download+extração num step,
 * transcrição noutro, cada um sob o teto de 60s de uma invocação). */
export async function extractAudio(videoPath: string, workDir: string): Promise<string> {
  const audioPath = join(workDir, "audio.mp3");
  const ffmpegPath = await getVendoredBinaryPath("ffmpeg");
  await run(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    videoPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    audioPath,
  ]);
  return audioPath;
}

/** Transcreve um arquivo de áudio já extraído via Whisper hospedado na Groq
 * (whisper-large-v3) — sem custo de API separada, mesma chave do resto do
 * pipeline. Só roda quando o vídeo não tem legenda nativa/automática. */
export async function transcribeAudioFile(audioPath: string): Promise<TranscriptSegment[]> {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const transcription = await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-large-v3",
    response_format: "verbose_json",
  });

  const segments = (transcription as unknown as { segments?: Array<{ start: number; end: number; text: string }> })
    .segments;

  if (!segments?.length) {
    const text = (transcription as unknown as { text?: string }).text ?? "";
    return text ? [{ startSeconds: 0, endSeconds: 0, text }] : [];
  }

  return segments.map((s) => ({ startSeconds: s.start, endSeconds: s.end, text: s.text.trim() }));
}

/** Composição das duas etapas — usada pelo caminho síncrono por link
 * (`ingest.ts`, ainda usado pelos smoke-tests e pelo Caminho A original). */
export async function transcribeWithWhisper(videoPath: string, workDir: string): Promise<TranscriptSegment[]> {
  const audioPath = await extractAudio(videoPath, workDir);
  return transcribeAudioFile(audioPath);
}
