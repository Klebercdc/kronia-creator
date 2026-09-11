import { chmod, mkdir, rename, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";

const run = promisify(execFile);

/**
 * yt-dlp/ffmpeg/ffprobe não existem no runtime serverless do Vercel, e
 * empacotá-los no build (via serverAssets do Nitro) estourou a memória do
 * processo de build — ~200MB de binário virando base64 dentro de um bundle
 * JS é pesado demais pro bundler aguentar (testado, reproduzido).
 *
 * Em vez disso, baixa sob demanda na primeira execução de cada instância
 * fria do servidor, direto pra /tmp (único diretório gravável garantido em
 * qualquer runtime serverless) — nunca entra no pacote de deploy. Isso troca
 * "estoura o build" por "a primeira chamada de cada instância fria demora
 * alguns segundos a mais pra baixar os binários" — instâncias quentes
 * reusam o que já foi baixado (cacheado em memória pra não checar disco
 * de novo a cada chamada).
 */
const BINARY_SOURCES: Record<string, { url: string; extractFrom?: "ffmpeg-tar" }> = {
  "yt-dlp": { url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" },
  ffmpeg: {
    url: "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
    extractFrom: "ffmpeg-tar",
  },
  ffprobe: {
    url: "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
    extractFrom: "ffmpeg-tar",
  },
};

const extractedPaths = new Map<string, Promise<string>>();
/** Baixa o tarball do ffmpeg só uma vez mesmo pedindo ffmpeg e ffprobe separados. */
let ffmpegTarExtraction: Promise<void> | null = null;

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  }
  const tmpPath = `${destPath}.download`;
  const nodeStream = createWriteStream(tmpPath);
  // @ts-expect-error — Response.body (web stream) é aceito pelo pipeline do Node 18+
  await pipeline(response.body, nodeStream);
  await rename(tmpPath, destPath);
}

async function extractFfmpegTar(destDir: string): Promise<void> {
  if (ffmpegTarExtraction) return ffmpegTarExtraction;

  ffmpegTarExtraction = (async () => {
    const tarPath = join(destDir, "ffmpeg-release.tar.xz");
    await downloadToFile(BINARY_SOURCES.ffmpeg.url, tarPath);
    // --strip-components=1 pq o tarball tem tudo dentro de uma pasta ffmpeg-*-static/
    await run("tar", ["-xf", tarPath, "-C", destDir, "--strip-components=1", "--wildcards", "*/ffmpeg", "*/ffprobe"]);
    await chmod(join(destDir, "ffmpeg"), 0o755);
    await chmod(join(destDir, "ffprobe"), 0o755);
  })();

  return ffmpegTarExtraction;
}

export function getVendoredBinaryPath(fileName: string): Promise<string> {
  const cached = extractedPaths.get(fileName);
  if (cached) return cached;

  const source = BINARY_SOURCES[fileName];
  if (!source) {
    throw new Error(`Binário "${fileName}" não está configurado em BINARY_SOURCES (vendored-binary.ts).`);
  }

  const promise = (async () => {
    const destDir = join(tmpdir(), "kronia-bin");
    const destPath = join(destDir, fileName);
    await mkdir(destDir, { recursive: true });

    try {
      const existing = await stat(destPath);
      if (existing.size > 0) return destPath;
    } catch {
      // ainda não baixado — segue pro download
    }

    if (source.extractFrom === "ffmpeg-tar") {
      await extractFfmpegTar(destDir);
    } else {
      await downloadToFile(source.url, destPath);
      await chmod(destPath, 0o755);
    }

    return destPath;
  })();

  extractedPaths.set(fileName, promise);
  return promise;
}
