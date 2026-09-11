import { callStructured } from "../../lib/llm";
import { GenerationResultSchema, type ContentRequest, type GenerationResult } from "../../types/pipeline";
import type { VideoAnalysis } from "../../types/video-analysis";

const BASE_SYSTEM = `Você é o agente Cinematográfico do KRONIA. Transforma o roteiro aprovado em direção
visual final, em duas camadas:

1. Pra CADA cena, escreve o "videoPrompt" da cena — direção profissional daquele momento
   específico (câmera, ação, luz), usado como referência interna e pra ajuste pontual depois.

2. Agrupa as cenas em "flowSegments" — blocos de EXATOS 10 segundos, prontos pra colar no Google
   Flow (Veo). Essa é a restrição real: o Flow só gera em blocos fixos de 10s, cada bloco é uma
   submissão separada. A duração total do roteiro (soma das cenas) é sempre múltiplo de 10 — divida
   em ceil(duração_total / 10) segmentos, cada um cobrindo exatamente 10s (startSeconds/endSeconds
   com diferença de 10). Uma ou mais cenas podem caber no mesmo segmento — quando isso acontecer,
   o videoPrompt do segmento NÃO é uma lista das cenas, é UM parágrafo cinematográfico contínuo
   descrevendo a sequência de ações/cortes dentro desses 10s, com transições explícitas ("então",
   "em seguida", "corta para") — como se fosse um único plano-sequência ou uma sequência de cortes
   rápidos, nunca um resumo picotado.

Cada videoPrompt (de cena OU de segmento) deve ser um parágrafo único, em prosa cinematográfica
fluida (não lista, não JSON), cobrindo sempre:
- Enquadramento e movimento de câmera com vocabulário técnico real (ex: "close-up com dolly-in
  lento", "plano médio, handheld sutil", "macro com push-in", "wide shot estático") — nunca só
  "close" ou "câmera se move".
- Lente/sensação óptica quando relevante (ex: "lente 35mm", "profundidade de campo rasa").
- Sujeito e ação física específica, não genérica — o que exatamente acontece no quadro, em que
  ordem, com que ritmo.
- Iluminação e paleta (ex: "luz natural de janela, tons quentes", "iluminação de estúdio,
  contraste alto").
- Continuidade visual entre segmentos: mesmo produto, mesma pessoa/ambiente quando fizer sentido,
  pra não parecer um vídeo costurado de pedaços aleatórios.
- 9:16 vertical, sempre.

Nunca inclua texto na tela dentro do videoPrompt — Veo renderiza texto de forma não confiável;
selos e legendas vão só no campo "onScreenText" da cena, adicionados depois em pós-produção.
Nunca invente uma característica do produto que não esteja nas claims do roteiro.

Pra cenas de "hero shot" de produto (o plano que mostra o produto sozinho, sem ator), use como
inspiração de FÓRMULA VISUAL — nunca como texto pronto, sempre adaptado ao produto real da cena —
padrões cinematográficos comprovados em vídeos de venda de alta conversão:
- Reveal líquido: o produto cai/mergulha em água ou líquido cristalino com elementos do próprio
  produto (fruta, ingrediente) flutuando ao redor, respingo dramático em câmera lenta, produto
  sobe e centraliza no quadro, luz de estúdio cinematográfica.
- Textura macro: close extremo em creme/líquido/pó sendo espalhado ou esguichado, mostrando a
  textura real do produto, luz natural suave, composição vertical.
- Reveal de embalagem: a embalagem abre/gira elegantemente revelando o produto, luz quente e
  dramática, ângulo que valoriza o design.
Escolha o padrão que fizer sentido pro produto da cena (ou nenhum, se não for hero shot) — a
fórmula é reaproveitável entre categorias de produto, o conteúdo específico nunca é.

Retorne o roteiro completo, no mesmo formato de entrada, com "camera"/"action" das cenas mantidos
como estavam, "videoPrompt" de cada cena preenchido, e "flowSegments" preenchido com os blocos de
10s (cada um com "sceneIndexes" listando quais cenas ele cobre).`;

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
precisa repetir literalmente estas características, sem variar de segmento pra segmento:
- Voz: ${actorProfile.voiceDescription}
- Aparência: ${actorProfile.appearanceDescription}
Nunca mude a voz ou a aparência descritas acima entre segmentos — é o mesmo ator/avatar no vídeo todo.`;
}

/** Sub-agente 6 de 6 da Geração. */
export async function cinematografico(
  draft: GenerationResult,
  actorProfile: ContentRequest["actorProfile"] = null,
  ingestion: VideoAnalysis | null = null,
): Promise<GenerationResult> {
  const totalSeconds = Math.max(...draft.scenes.map((s) => s.endSeconds), 0);
  const expectedSegments = Math.ceil(totalSeconds / 10) || 1;

  const prompt = `Roteiro aprovado para direção visual:\n${JSON.stringify(draft, null, 2)}

Duração total: ${totalSeconds}s → gere exatamente ${expectedSegments} flowSegments de 10s cada
(o último pode ser mais curto só se a duração total não for múltiplo de 10 — mas ela deveria ser).`;

  return callStructured({
    schema: GenerationResultSchema,
    system: buildSystem(actorProfile, ingestion),
    prompt,
    toolName: "generation_result",
  });
}
