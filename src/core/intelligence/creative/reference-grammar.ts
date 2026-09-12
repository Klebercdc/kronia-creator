import type { VideoAnalysis } from "../../../types/video-analysis";

/**
 * Reference Intelligence (Fase 2B) — traduz um `VideoAnalysis` (já
 * produzido pelo Job Engine em `ingest_reference_video`, ver
 * core/jobs/reference-ingestion.ts + core/ingestion/analyze.ts) num bloco
 * de texto de GRAMÁTICA CRIATIVA pro Creative Reasoning consumir.
 *
 * Não duplica ingestão nenhuma — reaproveita o `VideoAnalysis` que já
 * existe pro pipeline de conteúdo, só projeta pros campos que importam
 * pra "como essa peça funciona" (formato, hook, câmera/enquadramento,
 * ritmo, mecanismos de persuasão, estrutura de cenas).
 *
 * REGRA DE IDENTIDADE: deliberadamente NUNCA inclui `hook.text` (fala/
 * legenda verbatim ou paráfrase do vídeo de referência) — copiar a fala
 * seria "copiar a peça", não "entender a gramática dela". O que entra
 * aqui é só TÉCNICA (tipo de hook, câmera, ritmo, mecanismo de
 * persuasão, estrutura em rótulos), nunca conteúdo/identidade/marca.
 */
export function buildReferenceGrammar(analysis: VideoAnalysis): string {
  const lines: string[] = [];

  lines.push(
    `Formato predominante: ${analysis.format.primary}${analysis.format.secondary ? ` (secundário: ${analysis.format.secondary})` : ""}.`,
  );
  lines.push(`Hook: tipo "${analysis.hook.type}", duração ${(analysis.hook.endSeconds - analysis.hook.startSeconds).toFixed(1)}s.`);
  lines.push(`Câmera/enquadramento: ${analysis.visual.camera}, ${analysis.visual.framing}.`);
  lines.push(`Ritmo: ${analysis.visual.cutsPerMinute.toFixed(1)} cortes/minuto, duração total ${analysis.durationSeconds.toFixed(1)}s.`);
  if (analysis.persuasion.length > 0) {
    lines.push(`Mecanismos de persuasão observados: ${analysis.persuasion.join(", ")}.`);
  }
  if (analysis.structure.length > 0) {
    lines.push(`Estrutura de cenas (rótulos, não conteúdo literal): ${analysis.structure.join(" -> ")}.`);
  }

  return lines.join("\n");
}
