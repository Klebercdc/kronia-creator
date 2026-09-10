import { readFile } from "node:fs/promises";

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return Number(m) * 60 + Number(s);
  }
  return Number(parts[0] ?? 0);
}

/**
 * Parser de WebVTT com dedup de legendas automáticas do YouTube — elas repetem a
 * mesma linha 2-3x em cues consecutivos enquanto "rolam" na tela.
 */
export async function parseVtt(path: string): Promise<TranscriptSegment[]> {
  const raw = await readFile(path, "utf-8");
  const blocks = raw.split(/\r?\n\r?\n/);
  const segments: TranscriptSegment[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const timeLineIndex = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIndex === -1) continue;

    const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((s) => s.trim().split(" ")[0]);
    const text = lines
      .slice(timeLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!text) continue;

    segments.push({ startSeconds: parseTimestamp(startRaw), endSeconds: parseTimestamp(endRaw), text });
  }

  const deduped: TranscriptSegment[] = [];
  for (const seg of segments) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.text === seg.text) {
      prev.endSeconds = seg.endSeconds;
      continue;
    }
    deduped.push({ ...seg });
  }

  return deduped;
}

export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${s.startSeconds.toFixed(1)}s] ${s.text}`).join("\n");
}
