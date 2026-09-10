import type { GenerationResult } from "../../types/pipeline";
import type { ComplianceViolation } from "../../types/compliance";

/**
 * Checagem determinística (sem IA) de frases de promessa absoluta —
 * inspirada no "Supervisor QA check: scan script for banned phrases" do
 * TikTok Viral Factory (repo auditado). Roda antes do gate de Compliance,
 * junto com numeric-guard.ts: nenhuma dessas frases deveria escapar dos 6
 * agentes de texto, mas aqui pegamos em código puro, sem gastar IA.
 */
const BANNED_PHRASES = [
  "garantido",
  "garantia total",
  "100% eficaz",
  "100% efetivo",
  "totalmente seguro",
  "sem nenhum risco",
  "cura definitivamente",
  "cura garantida",
  "resultado garantido",
  "nunca falha",
  "sempre funciona",
  "aprovado por médicos",
  "recomendado por médicos",
  "melhor do mercado",
  "único que funciona",
  "milagroso",
  "milagre",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const NORMALIZED_BANNED_PHRASES = BANNED_PHRASES.map((phrase) => ({ original: phrase, normalized: normalize(phrase) }));

export function checkBannedAbsoluteClaims(generation: GenerationResult): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const scene of generation.scenes) {
    const fields: Array<[string, string | null]> = [
      ["narration", scene.narration],
      ["onScreenText", scene.onScreenText],
    ];

    for (const [field, text] of fields) {
      if (!text) continue;
      const normalizedText = normalize(text);

      for (const { original, normalized } of NORMALIZED_BANNED_PHRASES) {
        if (normalizedText.includes(normalized)) {
          violations.push({
            group: "afirmacoes_absolutas",
            flaggedText: text,
            reason: `Frase de promessa absoluta ("${original}") no campo "${field}" da cena ${scene.index} — checagem automática, sem IA.`,
            suggestion: `Remover ou suavizar "${original}" — usar linguagem qualificada ("pode ajudar", "segundo avaliações") em vez de garantia absoluta.`,
          });
        }
      }
    }
  }

  return violations;
}
