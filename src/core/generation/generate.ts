import type { ContentRequest, FormatRecommendation, GenerationResult } from "../../types/pipeline";
import { roteirista } from "./roteirista";
import { marketing } from "./marketing";
import { teologo } from "./teologo";
import { psicologiaDeCompra } from "./psicologia-compra";
import { persuasao } from "./persuasao";
import { cinematografico } from "./cinematografico";

/**
 * Etapa 4 — Geração. Cadeia fixa de sub-agentes:
 * Roteirista → Marketing → Teólogo (só se project === "jeova_fala") →
 * Psicologia de Compra → Persuasão → Cinematográfico.
 */
export async function generate(
  request: ContentRequest,
  recommendation: FormatRecommendation,
): Promise<GenerationResult> {
  let draft = await roteirista(request, recommendation);
  draft = await marketing(draft, request, recommendation);

  if (request.project === "jeova_fala") {
    draft = await teologo(draft);
  }

  draft = await psicologiaDeCompra(draft);
  draft = await persuasao(draft);
  draft = await cinematografico(draft, request.actorProfile);

  return draft;
}
