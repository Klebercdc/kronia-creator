import { callStructuredVision } from "../../lib/openai";
import { VideoAnalysisSchema, type VideoAnalysis } from "../../types/video-analysis";
import { CONTENT_FORMATS, HOOK_TYPES, PERSUASION_MECHANISMS } from "../../types/taxonomy";
import type { TranscriptSegment } from "./transcribe";

const SYSTEM = `Você analisa frames de um vídeo de referência (em ordem cronológica, com timestamp)
e o transcript correspondente, e devolve a MECÂNICA do vídeo como dados estruturados — não um
resumo do conteúdo, a estrutura por trás dele: como o hook prende atenção, como as cenas se
encadeiam, o ritmo, os mecanismos de persuasão.

Formatos possíveis: ${CONTENT_FORMATS.join(", ")}.
Tipos de hook possíveis: ${HOOK_TYPES.join(", ")}.
Mecanismos de persuasão possíveis: ${PERSUASION_MECHANISMS.join(", ")}.
Nunca invente uma categoria fora dessas listas, nem descreva algo que não está visível nos
frames ou no transcript — se não der pra saber, diga o que é razoável concluir a partir do que
foi mostrado, não invente detalhe.

CÂMERA — distinga observado de inferido: "cameraConfidence" é "fato" só quando o movimento de
câmera (travelling, zoom, pan, estático) está claramente visível comparando os frames em
sequência; é "inferencia" quando os frames não deixam claro se o movimento é da câmera ou do
personagem/objeto em quadro — nesse caso descreva sua melhor suposição em "camera" mas marque
como inferência, nunca apresente como certeza o que não é.`;

const InferredSchema = VideoAnalysisSchema.omit({
  sourceUrl: true,
  framesAnalyzed: true,
  transcriptSource: true,
});

type AnalyzedFields = Omit<VideoAnalysis, "sourceUrl" | "framesAnalyzed" | "transcriptSource">;

export async function analyzeFrames(
  framePaths: string[],
  frameTimestamps: number[],
  transcript: TranscriptSegment[],
  durationSeconds: number,
): Promise<AnalyzedFields> {
  const transcriptText = transcript.length
    ? transcript.map((s) => `[${s.startSeconds.toFixed(1)}s] ${s.text}`).join("\n")
    : "(sem transcript disponível — classifique só a partir dos frames)";

  const prompt = `Duração total: ${durationSeconds.toFixed(1)}s.
Frames em ordem, com timestamp: ${frameTimestamps.map((t) => `${t.toFixed(1)}s`).join(", ")}.

Transcript:
${transcriptText}

Classifique a mecânica deste vídeo.`;

  return callStructuredVision({
    schema: InferredSchema,
    system: SYSTEM,
    prompt,
    framePaths,
    toolName: "video_analysis",
  });
}
