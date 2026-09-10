import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);

export interface DownloadResult {
  videoPath: string;
  subtitlePath: string | null;
  info: { title?: string; uploader?: string; duration?: number };
  workDir: string;
}

/** Baixa o vídeo (até 720p) e legendas (manuais primeiro, depois automáticas) via yt-dlp. */
export async function downloadVideo(url: string): Promise<DownloadResult> {
  const workDir = await mkdtemp(join(tmpdir(), "kronia-ingest-"));
  const outputTemplate = join(workDir, "video.%(ext)s");

  await run(
    "yt-dlp",
    [
      "-f",
      "bv*[height<=720]+ba/b[height<=720]/best",
      "--write-sub",
      "--write-auto-sub",
      "--sub-lang",
      "en.*,pt.*",
      "--sub-format",
      "vtt",
      "--write-info-json",
      "--no-playlist",
      "-o",
      outputTemplate,
      url,
    ],
    { maxBuffer: 1024 * 1024 * 50 },
  );

  const files = await readdir(workDir);
  const videoFile = files.find((f) => f.startsWith("video.") && !f.endsWith(".json") && !f.endsWith(".vtt"));
  if (!videoFile) {
    throw new Error(`yt-dlp não gerou arquivo de vídeo em ${workDir} (arquivos: ${files.join(", ")})`);
  }

  const subtitleFile = files.find((f) => f.endsWith(".vtt")) ?? null;

  let info: DownloadResult["info"] = {};
  const infoFile = files.find((f) => f.endsWith(".info.json"));
  if (infoFile) {
    const raw = JSON.parse(await readFile(join(workDir, infoFile), "utf-8"));
    info = { title: raw.title, uploader: raw.uploader, duration: raw.duration };
  }

  return {
    videoPath: join(workDir, videoFile),
    subtitlePath: subtitleFile ? join(workDir, subtitleFile) : null,
    info,
    workDir,
  };
}
