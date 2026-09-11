import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadReferenceVideoUpload } from "../../lib/supabase";
import type { DownloadResult } from "./download";

/**
 * Alternativa ao yt-dlp: baixa um vídeo que o próprio usuário enviou (ex:
 * gravação de tela, quando o link direto da plataforma não funciona) do
 * Supabase Storage pra /tmp. Sem legenda embutida — a Ingestão cai direto
 * pro Whisper pra esse caso (ver ingest.ts).
 */
export async function downloadFromStorage(storagePath: string): Promise<DownloadResult> {
  const buffer = await downloadReferenceVideoUpload(storagePath);
  const workDir = await mkdtemp(join(tmpdir(), "kronia-ingest-upload-"));
  const videoPath = join(workDir, "video.mp4");
  await writeFile(videoPath, Buffer.from(buffer));

  return {
    videoPath,
    subtitlePath: null,
    info: {},
    workDir,
  };
}
