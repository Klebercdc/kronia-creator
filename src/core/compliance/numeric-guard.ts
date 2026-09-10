import type { GenerationResult } from "../../types/pipeline";
import type { EvidencedClaim } from "../../types/evidence";
import type { ComplianceViolation } from "../../types/compliance";

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

function extractNumbers(text: string): string[] {
  return text.match(NUMBER_PATTERN) ?? [];
}

/**
 * Checagem determinística (sem IA) rodada ANTES do gate de Compliance: todo
 * número que aparece na narração/onScreenText das cenas precisa existir
 * literalmente em alguma claim com kind "fato" do produto — senão é
 * estatística/prazo/percentual inventado, e nenhum dos 6 agentes de texto
 * deveria ter deixado passar. Roda em código puro, sem gastar chamada de IA
 * e sem depender de nenhum modelo "se comportar" — pega o que escapar dos
 * prompts antes até de gastar uma chamada com o gate de IA.
 *
 * Limitação conhecida: só compara dígitos literais. Uma claim escrita por
 * extenso ("cinquenta por cento") não casa com "50%" na narração mesmo
 * quando o número é fiel — nesse caso confia-se nos prompts dos agentes de
 * texto, que já instruem a nunca reescrever um número por extenso como
 * "mais preciso".
 */
export function checkFabricatedNumbers(
  generation: GenerationResult,
  productInfo: EvidencedClaim[],
): ComplianceViolation[] {
  const evidencedNumbers = new Set(
    productInfo.filter((claim) => claim.kind === "fato").flatMap((claim) => extractNumbers(claim.text)),
  );

  const violations: ComplianceViolation[] = [];

  function checkField(location: string, text: string | null) {
    if (!text) return;
    for (const number of extractNumbers(text)) {
      if (evidencedNumbers.has(number)) continue;
      violations.push({
        group: "promessas_nao_comprovadas",
        flaggedText: text,
        reason: `Número "${number}" em ${location} não existe em nenhuma claim com kind "fato" — parece inventado (checagem automática, sem IA).`,
        suggestion: `Remover ou generalizar "${number}" nesse trecho, ou reescrever usando exatamente as palavras de uma claim "fato" existente, sem introduzir um número que não veio do usuário.`,
      });
    }
  }

  for (const scene of generation.scenes) {
    checkField(`"narration" da cena ${scene.index}`, scene.narration);
    checkField(`"onScreenText" da cena ${scene.index}`, scene.onScreenText);
  }
  checkField('"caption"', generation.caption);

  return violations;
}
