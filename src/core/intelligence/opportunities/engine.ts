import { callStructured } from "../../../lib/llm";
import { CONTENT_FORMATS, HOOK_TYPES, PERSUASION_MECHANISMS } from "../../../types/taxonomy";
import { creatorDnaToPromptText, type CreatorDna } from "../memory/creator-dna";
import type { TrendAnalysis, TrendInput } from "../trends/schemas";
import { OpportunityListSchema, type Opportunity } from "./schemas";

const SYSTEM = `Você é o Opportunity Engine da KRONIA — recebe a interpretação de uma tendência,
o histórico do criador (Creator DNA) e o nicho/objetivo dele, e decide QUAIS oportunidades de
conteúdo fazem sentido criar.

Você não responde "aqui estão algumas ideias". Você responde: "aqui está o que faz sentido
PRA ESTE criador, NESTE nicho, NESTE momento, e por quê" — cada oportunidade precisa justificar
sua existência (campo "reasoning"), citando a tendência, o nicho, e como se relaciona (ou não
repete) o histórico do criador.

Formatos possíveis: ${CONTENT_FORMATS.join(", ")}.
Tipos de hook possíveis: ${HOOK_TYPES.join(", ")}.
Mecanismos de persuasão possíveis: ${PERSUASION_MECHANISMS.join(", ")}.
Nunca use uma categoria fora dessas listas.

DIVERSIDADE: se pedirem N oportunidades, elas devem cobrir ângulos DIFERENTES entre si
(educativo, erro, mito, comparação, storytelling, curiosidade, demonstração, opinião — não gere
N variações do mesmo ângulo).

ANTI-REPETIÇÃO: se um tema/ângulo já aparece nos "últimos temas" do Creator DNA, ou é muito
parecido semanticamente, NÃO repita — gere algo genuinamente novo ou avise no reasoning que
está evitando repetir.

SCORE: preencha os componentes numéricos (trendRelevance, creatorFit, audienceFit, novelty até
20; commercialFit, executionFit até 10) de forma honesta e proporcional ao que você mesmo
escreveu no reasoning — não infle. Isso é uma heurística de aderência, nunca uma probabilidade
de viralização.

Se a tendência não tiver relação real com o nicho, é válido devolver poucas oportunidades (ou
nenhuma) em vez de forçar conexão fraca.`;

/** Opportunity Engine — 1 chamada LLM (Groq), síncrona, mesmo motivo do
 * Trend Interpreter: não é trabalho pesado o suficiente pro Job Engine. */
export async function generateOpportunities(params: {
  trendInput: TrendInput;
  trendAnalysis: TrendAnalysis;
  creatorDna: CreatorDna;
  count?: number;
}): Promise<Opportunity[]> {
  const { trendInput, trendAnalysis, creatorDna, count = 5 } = params;

  const prompt = `Tendência: "${trendInput.trendText}"
Nicho do criador: ${trendInput.niche}
Objetivo do criador: ${trendInput.objective}

Interpretação da tendência:
${JSON.stringify(trendAnalysis, null, 2)}

Creator DNA (histórico do criador):
${creatorDnaToPromptText(creatorDna)}

Gere até ${count} oportunidades de conteúdo, diversificadas entre si, cada uma justificada.`;

  const result = await callStructured({
    schema: OpportunityListSchema,
    system: SYSTEM,
    prompt,
    toolName: "opportunity_list",
  });

  return result.opportunities;
}
