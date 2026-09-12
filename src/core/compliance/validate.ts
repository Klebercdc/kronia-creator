import { callStructuredText } from "../../lib/openai";
import { ComplianceResultSchema, RULE_GROUPS, type ComplianceResult } from "../../types/compliance";
import type { ContentRequest, GenerationResult } from "../../types/pipeline";
import { checkCopyright } from "./copyright-check";
import { checkFabricatedNumbers } from "./numeric-guard";
import { checkBannedAbsoluteClaims } from "./absolute-claims-guard";
import { checkCliches } from "./cliche-guard";

const GENERAL_RULE_GROUPS = RULE_GROUPS.filter((g) => g !== "propriedade_intelectual");

const SYSTEM = `Você é o gate de Compliance do KRONIA. Verifica um roteiro gerado contra os grupos de
regra: ${GENERAL_RULE_GROUPS.join(", ")}.

(Propriedade intelectual é checada por um agente dedicado à parte — não avalie esse grupo aqui.)

Regra central: nenhuma claim pode ser afirmação absoluta sem evidência (uma claim com kind
diferente de "fato" não pode ser apresentada como certeza no texto).
"originalidade_anti_copia": verifique se o texto do roteiro não repete frases literais do vídeo
de referência, quando houver.

NÃO exija/sinalize selo de divulgação comercial (#Ad) nem aviso de "conteúdo gerado por IA" no
texto das cenas — o roteiro é copiado/colado direto no Flow, e a divulgação (toggle de Conteúdo
de Marca/Parceria Paga, rotulagem de IA) acontece na hora de postar no TikTok, fora deste
roteiro; exigir isso aqui seria redundante com o que a plataforma já cobre.

Para "afirmacoes_absolutas" e "promessas_nao_comprovadas": ao escrever a "suggestion", NUNCA
sugira inventar uma fonte, teste ou número que não está em nenhuma claim com kind "fato" — a
correção certa é generalizar ou remover o dado específico não comprovado, nunca dar mais
credibilidade falsa a ele. Se a claim "fato" diz "mantém a temperatura por várias horas" e o
roteiro escreveu "mantém por até 4 horas segundo testes independentes", isso é violação mesmo
parecendo mais crível — a suggestion deve pedir para voltar ao que a claim "fato" realmente diz.

Para cada violação, aponte o texto exato sinalizado (flaggedText), o motivo (reason) e uma
sugestão de correção concreta (suggestion) — nunca uma reprovação genérica.`;

const InferredSchema = ComplianceResultSchema.omit({ attempt: true });

/** Etapa 5 — Compliance (gate). Combina o check geral com a checagem
 * dedicada de propriedade intelectual num único resultado. */
export async function validateCompliance(
  request: ContentRequest,
  generation: GenerationResult,
  attempt: number,
): Promise<ComplianceResult> {
  const prompt = `Modo: ${request.mode}. Projeto: ${request.project}.
Roteiro para validação:\n${JSON.stringify(generation, null, 2)}`;

  const fabricatedNumberViolations = checkFabricatedNumbers(generation, request.productInfo);
  const bannedPhraseViolations = checkBannedAbsoluteClaims(generation);
  const clicheViolations = checkCliches(generation);

  const [general, copyrightViolations] = await Promise.all([
    callStructuredText({
      schema: InferredSchema,
      system: SYSTEM,
      prompt,
      toolName: "compliance_result",
    }),
    checkCopyright(generation),
  ]);

  const violations = [
    ...fabricatedNumberViolations,
    ...bannedPhraseViolations,
    ...clicheViolations,
    ...general.violations,
    ...copyrightViolations,
  ];
  const checkedGroups = Array.from(
    new Set([
      ...general.checkedGroups,
      "propriedade_intelectual" as const,
      "promessas_nao_comprovadas" as const,
      "afirmacoes_absolutas" as const,
      "cliche_generico" as const,
    ]),
  );

  return {
    approved: violations.length === 0,
    checkedGroups,
    violations,
    attempt,
  };
}
