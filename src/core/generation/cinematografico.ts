import { callStructuredText } from "../../lib/openai";
import { type ContentRequest, type GenerationResult } from "../../types/pipeline";
import type { VideoAnalysis } from "../../types/video-analysis";
import { RevisionInferredSchema, DECISION_LOG_PROMPT_BLOCK, appendDecisionLog } from "./decision-log";

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

As 3 fórmulas acima valem quando a cena for de produto físico com embalagem. Quando o
produto/oferta (pelas claims do roteiro) NÃO tiver essas características (serviço, curso,
conteúdo digital, experiência), NÃO force nenhuma das 3 — construa a própria fórmula visual do
zero, no mesmo padrão de rigor técnico das outras (enquadramento nomeado, movimento de câmera
real, iluminação, sujeito e ação específica), ancorada no que as claims do produto efetivamente
descrevem. Registre em "decisaoResumo"/"motivoDecisao" qual fórmula usou (uma das 3 existentes,
ou uma nova) e por quê.

VOICE & PERFORMANCE — cada flowSegment carrega 4 campos próprios de atuação, além do videoPrompt:

- "gaze" (olhar): camada dirigível PRÓPRIA, separada da câmera e da ação física — direcione
  intensidade/foco em função do que está sendo dito neste bloco especificamente (ex: "olhar
  penetrante e firme, ganha intensidade na palavra final do bloco"). Nunca deixe vazio/genérico.
- "gestureMap": lista de {trigger, gesture} — cada entrada amarra um gesto a uma palavra/trecho
  específico da fala deste bloco (ex: {trigger: "compartilha com três amigos", gesture: "conta
  natural com os dedos, breve, sem congelar a mão"}). Nunca "gesticula naturalmente" solto sem
  dizer com QUAL palavra o gesto se conecta.
- "voiceTimbre": timbre/tom da voz neste bloco especificamente (grave/suave/quente/etc.) — pode
  variar de bloco pra bloco (ex.: bloco 1 mais contido, bloco 3 com mais convicção), nunca é
  obrigatoriamente idêntico em todos os blocos mesmo com o mesmo ator.
- "interpretationMode": o registro emocional/de interpretação deste bloco (ex.: "contido e
  íntimo", "urgente e fervoroso") — a intensidade pode crescer entre blocos, não precisa ser
  plana do início ao fim.

CORPO VIVO, NUNCA ESTÁTICO: nenhum gesto ou expressão descrita pode congelar no meio do
movimento — ao completar um gesto, o corpo retorna a um estado neutro de vida (respiração,
pequeno ajuste de peso, piscar), nunca uma pose parada. Isso vale pro "videoPrompt" do segmento
inteiro, não só pro gestureMap.

ESTRUTURA HOOK/DESENVOLVIMENTO/CTA POR BLOCO DE 10s: quando a duração total do roteiro for
múltiplo de 30s, preencha "narrativeFunction" em CADA flowSegment: o(s) primeiro(s) 10s do bloco
de 30s = "gancho", o(s) do meio = "desenvolvimento", o(s) último(s) = "cta" — nunca deixe null
nesse caso. Fora desse caso (duração não múltipla de 30s), pode deixar null. A contagem de
palavras/segundo (regra já usada pelo Roteirista) precisa ser reconferida aqui no nível do BLOCO
de 10s real — a fala que você descrever pro segmento precisa realmente caber nos 10s daquele
bloco específico, não só na cena narrativa original.

Retorne o roteiro completo, no mesmo formato de entrada, com "camera"/"action" das cenas mantidos
como estavam, "videoPrompt" de cada cena preenchido, e "flowSegments" preenchido com os blocos de
10s (cada um com "sceneIndexes", "gaze", "gestureMap", "voiceTimbre", "interpretationMode" e
"narrativeFunction" preenchidos).

${DECISION_LOG_PROMPT_BLOCK}`;

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

  const isMultipleOf30 = totalSeconds > 0 && totalSeconds % 30 === 0;
  const structureBlock = isMultipleOf30
    ? `\nDuração múltipla de 30s: preencha "narrativeFunction" em todo flowSegment (gancho/desenvolvimento/cta), nunca null.`
    : "";

  const prompt = `Roteiro aprovado para direção visual:\n${JSON.stringify(draft, null, 2)}

Duração total: ${totalSeconds}s → gere exatamente ${expectedSegments} flowSegments de 10s cada
(o último pode ser mais curto só se a duração total não for múltiplo de 10 — mas ela deveria ser).${structureBlock}`;

  const inferred = await callStructuredText({
    schema: RevisionInferredSchema,
    system: buildSystem(actorProfile, ingestion),
    prompt,
    toolName: "generation_result",
  });

  return appendDecisionLog(inferred, draft.decisionLog, "cinematografico");
}
