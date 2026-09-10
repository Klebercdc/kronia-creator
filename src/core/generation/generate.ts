import type {
  ClassificationResult,
  ContentRequest,
  FormatRecommendation,
  GenerationResult,
} from "../../types/pipeline";
import type { VideoAnalysis } from "../../types/video-analysis";
import { roteirista } from "./roteirista";
import { marketing } from "./marketing";
import { teologo } from "./teologo";
import { psicologiaDeCompra } from "./psicologia-compra";
import { persuasao } from "./persuasao";
import { cinematografico } from "./cinematografico";
import { seo } from "./seo";

/**
 * Etapa 4 — Geração. Cadeia fixa de sub-agentes:
 * Roteirista → Marketing → Teólogo (só se project === "jeova_fala") →
 * Psicologia de Compra → Persuasão → Cinematográfico → SEO.
 *
 * `classification` e `ingestion` só existem no Caminho A (vídeo de
 * referência) — quando presentes, carregam a estrutura e a direção visual
 * do vídeo que comprovadamente funcionou até o Roteirista e o
 * Cinematográfico, em vez de se perderem depois da Recomendação.
 */
export async function generate(
  request: ContentRequest,
  recommendation: FormatRecommendation,
  classification: ClassificationResult | null = null,
  ingestion: VideoAnalysis | null = null,
): Promise<GenerationResult> {
  let draft = await roteirista(request, recommendation, classification);
  draft = await marketing(draft, request, recommendation);

  if (request.project === "jeova_fala") {
    draft = await teologo(draft);
  }

  draft = await psicologiaDeCompra(draft);
  draft = await persuasao(draft);
  draft = await cinematografico(draft, request.actorProfile, ingestion);
  draft = await seo(draft, request);

  return draft;
}
