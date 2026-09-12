import type { GenerationResult } from "../../types/pipeline";
import type { ComplianceViolation } from "../../types/compliance";

/**
 * Checagem determinística (sem IA) de clichê/frase genérica — mesmo padrão
 * de absolute-claims-guard.ts. Existe porque o teste real (caso do anel)
 * provou que pedir "nunca use clichê" só na instrução, sem checagem, é
 * contornável (a LLM trocou "pensar" por "refletir" e passou) — o problema
 * não é a OpenAI ser fraca, é que autoverificação DENTRO da mesma chamada
 * que gerou o texto tende a se autoaprovar. Por isso os padrões abaixo são
 * REGEX com alternância de sinônimo (fuzzy o suficiente pra pegar variação
 * de palavra, sem precisar de comparação semântica/embedding), não string
 * exata — e rodam DEPOIS da chamada de IA, nunca no lugar dela.
 */
const CLICHE_PATTERNS: { label: string; regex: RegExp }[] = [
  {
    label: "abertura tipo 'você já parou pra pensar/refletir/considerar'",
    regex: /voc[eê] j[aá] (parou|parar(?:ia)?|pensou) (pra|para) (pensar|refletir|considerar)/i,
  },
  {
    label: "abertura genérica 'descubra/desvende'",
    regex: /\b(descubra|desvende)\s+(o|a|como|por ?que|quem)\b/i,
  },
  {
    label: "'transforme sua vida/rotina/dia a dia'",
    regex: /transform[ae]\s+(a\s+)?(sua|o seu)\s+(vida|rotina|dia\s*a\s*dia)/i,
  },
  {
    label: "'não é apenas um / mais do que um simples'",
    regex: /(n[aã]o\s+[eé]\s+apenas\s+um|mais\s+do\s+que\s+um\s+simples)/i,
  },
  {
    label: "'chegou a hora de'",
    regex: /chegou\s+a\s+hora\s+de/i,
  },
  {
    label: "CTA genérico solto ('garanta o seu'/'não perca'/'confira agora')",
    regex: /\b(garanta\s+o\s+seu|n[aã]o\s+perca(?:\s+essa)?|confira\s+agora)\b/i,
  },
] as const;

export function checkCliches(generation: GenerationResult): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  function checkField(location: string, text: string | null) {
    if (!text) return;
    for (const { label, regex } of CLICHE_PATTERNS) {
      if (regex.test(text)) {
        violations.push({
          group: "cliche_generico",
          flaggedText: text,
          reason: `Padrão de clichê genérico (${label}) em ${location} — checagem automática, sem IA. Frase que serviria pra qualquer produto do nicho, não só este.`,
          suggestion: `Reescrever a frase inteira ancorada numa característica REAL deste produto — nunca só trocar a palavra do clichê por um sinônimo.`,
        });
      }
    }
  }

  for (const hook of generation.hooks) {
    checkField('"hooks"', hook);
  }
  for (const scene of generation.scenes) {
    checkField(`"narration" da cena ${scene.index}`, scene.narration);
    checkField(`"onScreenText" da cena ${scene.index}`, scene.onScreenText);
  }
  checkField('"caption"', generation.caption);

  return violations;
}
