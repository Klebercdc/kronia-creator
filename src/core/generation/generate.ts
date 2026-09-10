import type { ContentRequest, FormatRecommendation, GenerationResult } from "../../types/pipeline";
import { roteirista } from "./roteirista";
import { teologo } from "./teologo";
import { persuasao } from "./persuasao";
import { cinematografico } from "./cinematografico";

/**
 * Etapa 4 — Geração. Orquestra os 4 sub-agentes na ordem fixa:
 * Roteirista → Teólogo (só se project === "jeova_fala") → Persuasão → Cinematográfico.
 */
export async function generate(
  request: ContentRequest,
  recommendation: FormatRecommendation,
): Promise<GenerationResult> {
  let draft = await roteirista(request, recommendation);

  if (request.project === "jeova_fala") {
    draft = await teologo(draft);
  }

  draft = await persuasao(draft);
  draft = await cinematografico(draft);

  return draft;
}
