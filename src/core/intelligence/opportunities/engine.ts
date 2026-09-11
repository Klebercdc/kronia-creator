import { callStructured } from "../../../lib/llm";
import { CONTENT_FORMATS, HOOK_TYPES, PERSUASION_MECHANISMS } from "../../../types/taxonomy";
import { creatorDnaToPromptText, type CreatorDna } from "../memory/creator-dna";
import type { TrendAnalysis, TrendInput } from "../trends/schemas";
import { OpportunityListSchema, type Opportunity } from "./schemas";

const SYSTEM = `Você é o Opportunity Engine da KRONIA — recebe um PRODUTO que o criador quer
vender, o nicho/objetivo dele, opcionalmente uma tendência, e o histórico dele (Creator DNA), e
decide QUAIS oportunidades de conteúdo/venda fazem sentido criar.

Você não responde "aqui estão algumas ideias". Você responde: "aqui está o que faz sentido PRA
ESTE criador vender ESTE produto PRA ESTA audiência, e por quê" — cada oportunidade precisa
justificar sua existência (campo "reasoning"), citando o produto, o nicho, a tendência (se houver),
e como se relaciona (ou não repete) o histórico do criador.

PRODUTO NÃO PRECISA PERTENCER AO NICHO. O que precisa fazer sentido é COMO o produto pode ser
apresentado pra aquela audiência, sem trair a identidade do criador. Procure uma ponte legítima
entre as características REAIS do produto (estética, uso demonstrável, contexto de utilização,
presente, coleção, design — o que for verdadeiro) e os interesses da audiência. NUNCA invente
propriedade, poder, benefício ou afirmação que não esteja implícita no que foi informado sobre o
produto — isso vale tanto quanto a regra de nunca inventar claim no resto do sistema. Se não
existir ponte legítima, diga isso claramente (é válido devolver poucas oportunidades, ou nenhuma,
em vez de forçar uma conexão fraca ou fabricada).

Formatos possíveis: ${CONTENT_FORMATS.join(", ")}.
Tipos de hook possíveis: ${HOOK_TYPES.join(", ")}.
Mecanismos de persuasão possíveis: ${PERSUASION_MECHANISMS.join(", ")}.
Nunca use uma categoria fora dessas listas.

DIVERSIDADE: se pedirem N oportunidades, elas devem cobrir ângulos DIFERENTES entre si
(educativo, erro, mito, comparação, storytelling, curiosidade, demonstração, opinião — não gere
N variações do mesmo ângulo).

ANTI-REPETIÇÃO: se um tema/ângulo já aparece nos "últimos temas" do Creator DNA, ou é muito
parecido semanticamente, NÃO repita — gere algo genuinamente novo ou avise no reasoning que está
evitando repetir.

SCORE: preencha os componentes numéricos de forma honesta e proporcional ao que você mesmo
escreveu no reasoning — não infle:
- trendRelevance (0-20): força da tendência informada (0 se não houver tendência).
- creatorFit (0-20): o quanto o ângulo escolhido combina com o histórico/posicionamento do
  criador, incluindo a legitimidade da ponte produto-nicho.
- audienceFit (0-20): o quanto a audiência desse nicho realmente se interessaria por esse produto
  apresentado dessa forma.
- novelty (0-20): quão pouco repetido é em relação ao Creator DNA.
- commercialFit (0-10): potencial comercial real do produto+ângulo pro objetivo declarado.
- executionFit (0-10): quão viável é executar esse ângulo com o formato escolhido.
Isso é uma heurística de aderência, nunca uma probabilidade de viralização — e o score pode e
deve ser BAIXO quando a oportunidade for fraca. Não existe obrigação de toda oportunidade
parecer boa.`;

/** Opportunity Engine — 1 chamada LLM (Groq), síncrona, mesmo motivo do
 * Trend Interpreter: não é trabalho pesado o suficiente pro Job Engine. */
export async function generateOpportunities(params: {
  trendInput: TrendInput;
  trendAnalysis: TrendAnalysis | null;
  creatorDna: CreatorDna;
  count?: number;
}): Promise<Opportunity[]> {
  const { trendInput, trendAnalysis, creatorDna, count = 5 } = params;

  const prompt = `Produto que o criador quer vender: ${trendInput.product}
Nicho do criador: ${trendInput.niche}
Objetivo do criador: ${trendInput.objective}
${
  trendAnalysis
    ? `\nTendência informada: "${trendInput.trendText}"\nInterpretação da tendência:\n${JSON.stringify(trendAnalysis, null, 2)}`
    : "\nNenhuma tendência informada — baseie as oportunidades só em produto + nicho + audiência + objetivo + histórico (trendRelevance deve ficar 0 em todas)."
}

Creator DNA (histórico do criador):
${creatorDnaToPromptText(creatorDna)}

Gere até ${count} oportunidades de conteúdo pra vender esse produto, diversificadas entre si, cada uma justificada.`;

  const result = await callStructured({
    schema: OpportunityListSchema,
    system: SYSTEM,
    prompt,
    toolName: "opportunity_list",
  });

  return result.opportunities;
}
