import { callStructured } from "../../lib/llm";
import { ClassificationResultSchema, type ClassificationResult } from "../../types/pipeline";
import type { VideoAnalysis } from "../../types/video-analysis";
import { CONTENT_FORMATS, HOOK_TYPES, PERSUASION_MECHANISMS } from "../../types/taxonomy";

const SYSTEM = `Você classifica a MECÂNICA de um vídeo de referência numa taxonomia fechada.
Formatos possíveis: ${CONTENT_FORMATS.join(", ")}.
Tipos de hook possíveis: ${HOOK_TYPES.join(", ")}.
Mecanismos de persuasão possíveis: ${PERSUASION_MECHANISMS.join(", ")}.
Nunca invente uma categoria fora dessas listas. Classifique apenas a partir dos dados
estruturados fornecidos (hook, formato observado, estrutura, ritmo visual) — não invente
conteúdo que não está no vídeo analisado.`;

const InferredSchema = ClassificationResultSchema.omit({ derivedFromReference: true });

/** Etapa 2 — Classificação. Só roda no Caminho A, com o resultado da Ingestão. */
export async function classify(video: VideoAnalysis): Promise<ClassificationResult> {
  const prompt = `Dados estruturados do vídeo de referência:\n${JSON.stringify(video, null, 2)}\n\nClassifique este vídeo.`;

  const result = await callStructured({
    schema: InferredSchema,
    system: SYSTEM,
    prompt,
    toolName: "classification_result",
  });

  return { ...result, derivedFromReference: true };
}
