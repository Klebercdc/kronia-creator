import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const run = promisify(execFile);

const MAX_FPS = 2.0;

export interface FrameInfo {
  path: string;
  timestampSeconds: number;
}

export interface VideoMeta {
  durationSeconds: number;
  width: number | null;
  height: number | null;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
}

export async function probeVideo(videoPath: string): Promise<VideoMeta> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    videoPath,
  ]);
  const data = JSON.parse(stdout) as { format?: { duration?: string }; streams?: FfprobeStream[] };
  const videoStream = (data.streams ?? []).find((s) => s.codec_type === "video") ?? {};
  const duration = parseFloat(data.format?.duration ?? videoStream.duration ?? "0");
  return {
    durationSeconds: duration,
    width: videoStream.width ?? null,
    height: videoStream.height ?? null,
  };
}

/** Orçamento de frames por duração — vídeo curto fica denso, vídeo longo é capado. */
function autoFps(durationSeconds: number, maxFrames: number): number {
  if (durationSeconds <= 0) return 1;
  let target: number;
  if (durationSeconds <= 30) target = Math.min(maxFrames, Math.max(12, Math.round(durationSeconds)));
  else if (durationSeconds <= 60) target = Math.min(maxFrames, 40);
  else if (durationSeconds <= 180) target = Math.min(maxFrames, 60);
  else if (durationSeconds <= 600) target = Math.min(maxFrames, 80);
  else target = maxFrames;

  const fps = Math.min(target / durationSeconds, MAX_FPS);
  return fps;
}

export async function extractFrames(
  videoPath: string,
  outDir: string,
  durationSeconds: number,
  maxFrames = 80,
): Promise<FrameInfo[]> {
  await mkdir(outDir, { recursive: true });
  const fps = autoFps(durationSeconds, maxFrames);
  const pattern = join(outDir, "frame_%04d.jpg");

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    videoPath,
    "-vf",
    `fps=${fps},scale=512:-2`,
    "-frames:v",
    String(maxFrames),
    "-q:v",
    "4",
    pattern,
  ]);

  const files = (await readdir(outDir)).filter((f) => f.startsWith("frame_")).sort();
  return files.map((f, i) => ({
    path: join(outDir, f),
    timestampSeconds: fps > 0 ? Number((i / fps).toFixed(2)) : 0,
  }));
}

/** Reduz a amostra de frames de forma uniforme — controla custo da chamada de visão. */
export function sampleFrames(frames: FrameInfo[], maxCount: number): FrameInfo[] {
  if (frames.length <= maxCount) return frames;
  const step = frames.length / maxCount;
  return Array.from({ length: maxCount }, (_, i) => frames[Math.min(frames.length - 1, Math.round(i * step))]);
}
