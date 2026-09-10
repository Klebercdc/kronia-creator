import { callStructured } from "../../lib/llm";
import { GenerationResultSchema, type ContentRequest, type GenerationResult } from "../../types/pipeline";
import type { VideoAnalysis } from "../../types/video-analysis";

const BASE_SYSTEM = `Você é o agente Cinematográfico do KRONIA. Transforma o roteiro aprovado em direção
visual final: para CADA cena, escreve um "videoPrompt" pronto pra colar direto no Google Flow
(Veo) e gerar aquele clipe especificamente — o Flow gera um plano por vez, então cada videoPrompt
é autossuficiente, não um resumo do vídeo inteiro.

Cada videoPrompt deve ser um parágrafo único, em prosa cinematográfica fluida (não lista, não
JSON), cobrindo sempre:
- Enquadramento e movimento de câmera com vocabulário técnico real (ex: "close-up com dolly-in
  lento", "plano médio, handheld sutil", "macro com push-in", "wide shot estático") — nunca só
  "close" ou "câmera se move".
- Lente/sensação óptica quando relevante (ex: "lente 35mm", "profundidade de campo rasa").
- Sujeito e ação física específica, não genérica — o que exatamente acontece no quadro, em que
  ordem, com que ritmo.
- Iluminação e paleta (ex: "luz natural de janela, tons quentes", "iluminação de estúdio,
  contraste alto").
- Continuidade visual entre cenas: mesmo produto, mesma pessoa/ambiente quando fizer sentido,
  pra não parecer um vídeo costurado de pedaços aleatórios.
- 9:16 vertical, sempre.

Nunca inclua texto na tela dentro do videoPrompt — Veo renderiza texto de forma não confiável;
selos e legendas vão só no campo "onScreenText", adicionados depois em pós-produção.
Nunca invente uma característica do produto que não esteja nas claims do roteiro.

Retorne o roteiro completo, no mesmo formato de entrada, com "camera"/"action" das cenas
mantidos como estavam e "videoPrompt" preenchido em cada cena.`;

function buildSystem(actorProfile: ContentRequest["actorProfile"], ingestion: VideoAnalysis | null): string {
  let system = BASE_SYSTEM;

  if (ingestion) {
    system += `

DIREÇÃO VISUAL DO VÍDEO DE REFERÊNCIA (já comprovada, use como base real, não invente do zero):
Câmera: ${ingestion.visual.camera}. Enquadramento: ${ingestion.visual.framing}.
Cortes por minuto: ${ingestion.visual.cutsPerMinute}.
Reaproveite esse vocabulário e ritmo de câmera/corte nos videoPrompts — é a mesma mecânica visual
que já funcionou, só com o produto/ator novos, nunca copiando o conteúdo literal do vídeo original.`;
  }

  if (!actorProfile) return system;

  return `${system}

ATOR PRINCIPAL FIXO — "${actorProfile.name}": todo videoPrompt que incluir esse personagem
precisa repetir literalmente estas características, sem variar de cena pra cena:
- Voz: ${actorProfile.voiceDescription}
- Aparência: ${actorProfile.appearanceDescription}
Nunca mude a voz ou a aparência descritas acima entre cenas — é o mesmo ator/avatar em todo o vídeo.`;
}

/** Sub-agente 6 de 6 da Geração. */
export async function cinematografico(
  draft: GenerationResult,
  actorProfile: ContentRequest["actorProfile"] = null,
  ingestion: VideoAnalysis | null = null,
): Promise<GenerationResult> {
  const prompt = `Roteiro aprovado para direção visual:\n${JSON.stringify(draft, null, 2)}`;

  return callStructured({
    schema: GenerationResultSchema,
    system: buildSystem(actorProfile, ingestion),
    prompt,
    toolName: "generation_result",
  });
}
