import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type ContentRequest, type GenerationResult } from "../../types/pipeline";
import type { VideoAnalysis } from "../../types/video-analysis";
import { RevisionInferredSchema, DECISION_LOG_PROMPT_BLOCK, appendDecisionLog } from "./decision-log";
import { validateFlowSegments, sanitizeGestureMap } from "./flow-segment-validator";

/** decisionLog nunca é pedido de volta aqui — esta correção só ajusta a
 * matemática dos flowSegments (index/startSeconds/endSeconds/
 * narrativeFunction), não é uma decisão criativa nova; o log acumulado é
 * só preservado, igual ao padrão já usado em compliance/correct.ts. */
const StructuralFixSchema = GenerationResultSchema.omit({ decisionLog: true });

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
descrevem.

REGISTRO ESTRUTURADO DA FÓRMULA (campo, não prosa livre): todo flowSegment tem os campos
"heroShotFormula" e "customHeroShotFormulaLabel". Se o bloco de 10s contiver um momento de hero
shot de produto, preencha "heroShotFormula" com "reveal_liquido", "textura_macro",
"reveal_embalagem" OU "custom" — nunca deixe null quando houver hero shot no bloco. Se escolher
"custom", "customHeroShotFormulaLabel" é OBRIGATÓRIO: um nome/descrição curta da fórmula inventada
(ex: "produto em uso real, mão fechando o zíper") — em qualquer outro caso
"customHeroShotFormulaLabel" fica null (nunca preencha se heroShotFormula não for "custom"). Se o
bloco não tiver hero shot nenhum (só ator falando, por exemplo), "heroShotFormula" fica null.

VOICE & PERFORMANCE — cada flowSegment carrega 4 campos próprios de atuação, além do videoPrompt.
PROIBIDO usar valores genéricos como "olhar natural", "gesticula naturalmente", "voz natural" ou
"fala de forma natural" — cada campo precisa de direção concreta, específica deste bloco:

- "gaze" (olhar): camada dirigível PRÓPRIA, separada da câmera e da ação física — direcione
  intensidade/foco em função do que está sendo dito neste bloco especificamente. Exemplo aceitável:
  "olhar direto para a lente durante a frase central, desviando brevemente para o produto no
  momento da revelação". Nunca deixe vazio/genérico.
- "gestureMap": lista de {trigger, gesture} — cada "trigger" precisa ser um trecho REAL e literal
  da narração das cenas deste bloco (código confere isso depois e descarta qualquer entrada cujo
  trigger não apareça na fala — nunca invente um trigger só pra preencher o campo). Exemplo
  aceitável: {trigger: "ao pronunciar 'fé'", gesture: "ele toca o anel com o polegar ao pronunciar
  'fé'"}. Se não houver um gatilho verbal real que justifique um gesto, deixe "gestureMap": [] —
  isso é preferível a inventar.
- "voiceTimbre": timbre/tom da voz neste bloco especificamente. Exemplo aceitável: "voz masculina
  próxima, firme e calorosa, com leve aumento de intensidade na frase final" — pode variar de
  bloco pra bloco (ex.: bloco 1 mais contido, bloco 3 com mais convicção), nunca é obrigatoriamente
  idêntico em todos os blocos mesmo com o mesmo ator.
- "interpretationMode": o registro emocional/de interpretação deste bloco. Exemplo aceitável:
  "íntimo e convicto, sem tom de locução publicitária" — a intensidade pode crescer entre blocos,
  não precisa ser plana do início ao fim.

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
10s (cada um com "sceneIndexes", "gaze", "gestureMap", "voiceTimbre", "interpretationMode",
"narrativeFunction", "heroShotFormula" e "customHeroShotFormulaLabel" preenchidos).

${DECISION_LOG_PROMPT_BLOCK}

Pro Cinematográfico especificamente: "motivoDecisao" precisa citar a decisão VISUAL concreta que
você tomou (enquadramento, movimento, escolha de hero shot etc.), nunca um motivo genérico de
processo. Rejeitado: "Escolhi esta abordagem porque é mais impactante." Aceitável: "Escolhi
macro close-up no anel porque a gravação de referência enfatiza o detalhe da peça e o objetivo é
aumentar percepção de acabamento sem alterar nenhuma característica factual do produto."`;

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

/** Correção estrutural determinística: 1 chamada direcionada, corrigindo
 * SÓ os campos estruturais dos flowSegments apontados pelo
 * `validateFlowSegments` (timing/narrativeFunction/heroShotFormula), sem
 * tocar em videoPrompt/gaze/gestureMap/voiceTimbre/interpretationMode —
 * mesma lógica de "1 correção + 1 reauditoria, nunca um loop" já usada em
 * compliance/correct.ts. Se a estrutura continuar errada depois dessa 1
 * tentativa, quem chama decide (aqui: falha explícita — nunca inventamos
 * um número/valor certo em código). */
async function fixFlowSegmentStructure(
  draft: GenerationResult,
  totalSeconds: number,
  issues: string[],
): Promise<GenerationResult> {
  const prompt = `Roteiro com flowSegments estruturalmente incorretos:\n${JSON.stringify(draft, null, 2)}

Duração total do roteiro: ${totalSeconds}s.

Problemas ESTRUTURAIS detectados em código (sem margem de interpretação) — corrija SOMENTE os
campos "index", "startSeconds", "endSeconds", "narrativeFunction", "heroShotFormula" e
"customHeroShotFormulaLabel" dos flowSegments até eliminar cada um destes; não altere videoPrompt,
gaze, gestureMap, voiceTimbre, interpretationMode, sceneIndexes nem qualquer outro campo do
roteiro:
${issues.map((i) => `- ${i}`).join("\n")}`;

  const fixed = await callStructuredText({
    schema: StructuralFixSchema,
    system: `Você corrige apenas a estrutura dos flowSegments de um roteiro do KRONIA: index
sequencial 0..n-1, startSeconds/endSeconds formando blocos contíguos de exatos 10s (sem gap nem
sobreposição, último bloco cobrindo até a duração total), narrativeFunction seguindo
gancho(1º bloco)/desenvolvimento(blocos do meio)/cta(último bloco) quando a duração total for
múltiplo de 30s, e customHeroShotFormulaLabel preenchido SOMENTE quando heroShotFormula==="custom"
(null em qualquer outro caso). Não reescreva nenhum outro campo do roteiro.`,
    prompt,
    toolName: "generation_result",
  });

  return { ...fixed, decisionLog: draft.decisionLog };
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

Duração total: ${totalSeconds}s → gere exatamente ${expectedSegments} flowSegments de EXATOS 10s
cada, sem exceção (0-10, 10-20, ..., até ${totalSeconds}s). Nenhum bloco final mais curto.${structureBlock}`;

  const inferred = await callStructuredText({
    schema: RevisionInferredSchema,
    system: buildSystem(actorProfile, ingestion),
    prompt,
    toolName: "generation_result",
  });

  let result = appendDecisionLog(inferred, draft.decisionLog, "cinematografico");
  result = { ...result, flowSegments: sanitizeGestureMap(result.flowSegments, result.scenes) };

  const issues = validateFlowSegments(result.flowSegments, totalSeconds);
  if (issues.length > 0) {
    result = await fixFlowSegmentStructure(result, totalSeconds, issues);
    result = { ...result, flowSegments: sanitizeGestureMap(result.flowSegments, result.scenes) };

    const remaining = validateFlowSegments(result.flowSegments, totalSeconds);
    if (remaining.length > 0) {
      throw new Error(
        `Cinematográfico: flowSegments continuam estruturalmente inválidos após 1 tentativa de correção determinística:\n${remaining.join("\n")}`,
      );
    }
  }

  return result;
}
