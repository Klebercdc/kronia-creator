import { callStructuredText } from "../../../lib/openai";
import { CONTENT_FORMATS } from "../../../types/taxonomy";
import type { EvidencedClaim } from "../../../types/evidence";
import {
  CreativeSpecSchema,
  CREATIVE_PATTERNS,
  VISUAL_MECHANICS,
  buildProductCapabilityMap,
  type CreativeSpec,
} from "./schemas";
import { FORMAT_KNOWLEDGE } from "./format-knowledge";

const InferredSchema = CreativeSpecSchema.omit({ version: true, productTruth: true });

const SYSTEM = `Você é o Creative Reasoning do KRONIA — recebe um produto (com evidências already
classificadas), uma ideia livre e/ou o contexto de uma Oportunidade, e decide COMO executar
visualmente isso: qual padrão criativo, qual mecânica visual concreta, qual sequência de shots
(se vídeo) e qual direção audiovisual.

Você NÃO decide "o que vender" (isso já foi decidido antes, pelo Opportunity Engine, se houver) —
você decide "como filmar/fotografar" a decisão que já existe.

PRODUCT TRUTH — REGRA ABSOLUTA: as características do produto que você recebe já vêm marcadas como
confirmadas/inferidas/desconhecidas. NUNCA promova uma característica desconhecida a confirmada.
NUNCA invente propriedade física, funcional ou de material que não esteja nas evidências. Se uma
mecânica exigiria uma propriedade não confirmada (ex.: "stretch test" exige elasticidade
confirmada), NÃO escolha essa mecânica — escolha uma mecânica segura com o que você realmente sabe,
ou deixe evidente na "reasoning" que a mecânica escolhida evita a característica não confirmada.

Formatos possíveis: ${CONTENT_FORMATS.join(", ")}.
Padrões criativos possíveis: ${CREATIVE_PATTERNS.join(", ")}.
Mecânicas visuais possíveis: ${VISUAL_MECHANICS.join(", ")}.
Nunca use uma categoria fora dessas listas.

Conhecimento por formato (propósito e padrões/mecânicas tipicamente compatíveis — use como guia, não
como regra rígida): ${JSON.stringify(FORMAT_KNOWLEDGE)}.

SHOT PATTERN (só quando media="video"): gere entre 1 e 6 shots. Cada shot precisa de function
(hook/demo/reação/cta/etc — texto livre curto), durationSeconds, camera e action. A soma das
durações dos shots deve bater com totalDurationSeconds. NÃO sobrecarregue um shot curto com várias
ações — um shot de 2-3s deve ter só 1 ação central.

DIRECTOR SPEC: preencha só o que fizer sentido pra esta execução — campos sem informação real devem
ficar null, nunca invente detalhe técnico só pra preencher.

CHARACTER/BRAND: characterConsistency e brandConstraints ficam null nesta fase, a menos que a
entrada informe algo explícito sobre isso.

REASONING: explique em 1-2 frases por que esse padrão+mecânica+direção fazem sentido pro produto e
pro objetivo — cite a evidência confirmada que embasa a escolha.`;

export interface CreativeReasoningInput {
  media: "image" | "video";
  productInfo: EvidencedClaim[];
  idea: string | null;
  opportunityContext: string | null;
  objective: string;
}

/** Creative Reasoning — 1 chamada LLM (OpenAI, callStructuredText), síncrona,
 * mesmo motivo do Opportunity/Trend: não é trabalho pesado o suficiente pro
 * Job Engine. Product Truth (productTruth) NÃO é perguntado ao LLM — é
 * construído em código a partir de EvidencedClaim[] (buildProductCapabilityMap)
 * e só devolvido como contexto no prompt, nunca como algo que a IA decide. */
export async function generateCreativeSpec(input: CreativeReasoningInput): Promise<CreativeSpec> {
  const productTruth = buildProductCapabilityMap(input.productInfo);

  const prompt = `Media alvo: ${input.media}
Objetivo: ${input.objective}
${input.idea ? `Ideia do usuário: ${input.idea}` : "Nenhuma ideia livre informada — decida a partir do produto e do objetivo."}
${input.opportunityContext ? `Contexto da Oportunidade escolhida: ${input.opportunityContext}` : ""}

Product Truth (já classificado, não reclassifique):
Confirmado: ${JSON.stringify(productTruth.confirmed.map((c) => c.text))}
Inferido: ${JSON.stringify(productTruth.inferred.map((c) => c.text))}
Sugerido: ${JSON.stringify(productTruth.recommended)}
Desconhecido (NUNCA afirmar nem sugerir mecânica que dependa disso): ${JSON.stringify(productTruth.unknown)}

Gere a execução visual completa (formato, padrão, mecânica, shot pattern se vídeo, direção).`;

  const inferred = await callStructuredText({
    schema: InferredSchema,
    system: SYSTEM,
    prompt,
    toolName: "creative_spec",
  });

  return {
    ...inferred,
    version: "v1" as const,
    productTruth,
  };
}

