import { chmod, mkdir, rename, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

/**
 * yt-dlp/ffmpeg/ffprobe não existem no runtime serverless do Vercel, e
 * empacotá-los no build (via serverAssets do Nitro) estourou a memória do
 * processo de build — ~200MB de binário virando base64 dentro de um bundle
 * JS é pesado demais pro bundler aguentar (testado, reproduzido).
 *
 * Em vez disso, baixa sob demanda na primeira execução de cada instância
 * fria do servidor, direto pra /tmp (único diretório gravável garantido em
 * qualquer runtime serverless) — nunca entra no pacote de deploy.
 *
 * IMPORTANTE: a primeira tentativa usava um .tar.xz + o binário `tar` do
 * sistema pra extrair — e `tar` também não existe no runtime do Vercel
 * (erro real em produção: "spawn tar ENOENT"). Corrigido pra usar só
 * arquivos .gz de um binário só (sem tar, sem múltiplos arquivos dentro),
 * descomprimidos com o módulo `zlib` nativo do Node — zero dependência de
 * qualquer binário de sistema, só código JS puro.
 */
const BINARY_SOURCES: Record<string, string> = {
  "yt-dlp": "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
  // mesmo binário estático do johnvansickle.com que o pacote ffmpeg-static usa,
  // só que baixado direto do release do GitHub como .gz de um arquivo só.
  ffmpeg: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64.gz",
  ffprobe: "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffprobe-linux-x64.gz",
};

const extractedPaths = new Map<string, Promise<string>>();

async function downloadAndDecompress(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  }
  const tmpPath = `${destPath}.download`;
  const isGz = url.endsWith(".gz");
  const source = Readable.fromWeb(response.body as never);
  const dest = createWriteStream(tmpPath);

  if (isGz) {
    await pipeline(source, createGunzip(), dest);
  } else {
    await pipeline(source, dest);
  }
  await rename(tmpPath, destPath);
}

export function getVendoredBinaryPath(fileName: string): Promise<string> {
  const cached = extractedPaths.get(fileName);
  if (cached) return cached;

  const url = BINARY_SOURCES[fileName];
  if (!url) {
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

    await downloadAndDecompress(url, destPath);
    await chmod(destPath, 0o755);
    return destPath;
  })();

  extractedPaths.set(fileName, promise);
  return promise;
}
