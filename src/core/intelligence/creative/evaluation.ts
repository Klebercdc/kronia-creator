import { FORMAT_KNOWLEDGE } from "./format-knowledge";
import type { CreativeEvaluation, CreativeSpec } from "./schemas";

/**
 * Creative Evaluation — avalia a CreativeSpec (a INTENÇÃO), antes do
 * compile. Distinto de Prompt QC (qc.ts), que avalia o PROMPT FINAL,
 * depois do compile. Determinístico — reaproveita o `reasoning` que o
 * Creative Reasoning já escreveu na spec e o FORMAT_KNOWLEDGE existente;
 * não é um novo agente LLM (item 7 do adendo final).
 */
export function evaluateCreativeSpec(spec: CreativeSpec): CreativeEvaluation {
  const notes: string[] = [];

  const knowledge = FORMAT_KNOWLEDGE[spec.format];
  const mechanicFitsPattern = knowledge
    ? knowledge.typicalPatterns.includes(spec.pattern) && knowledge.compatibleMechanics.includes(spec.mechanic)
    : true;
  if (knowledge && !mechanicFitsPattern) {
    notes.push(
      `Padrão "${spec.pattern}" ou mecânica "${spec.mechanic}" não são típicos do formato "${spec.format}" (esperado: padrões ${knowledge.typicalPatterns.join("/")}, mecânicas ${knowledge.compatibleMechanics.join("/")}).`,
    );
  }

  let shotSequenceFeasible = true;
  if (spec.media === "video" && spec.shotPattern) {
    const shotCount = spec.shotPattern.shots.length;
    if (knowledge && (shotCount < knowledge.minShots || shotCount > knowledge.maxShots)) {
      shotSequenceFeasible = false;
      notes.push(
        `Formato "${spec.format}" costuma ter entre ${knowledge?.minShots} e ${knowledge?.maxShots} shots; spec tem ${shotCount}.`,
      );
    }
  }

  const productTruthRespected = spec.productTruth.unknown.every(
    (term) => !spec.reasoning.toLowerCase().includes(term.toLowerCase()) || spec.reasoning.toLowerCase().includes("evita"),
  );
  if (!productTruthRespected) {
    notes.push("O reasoning menciona uma característica desconhecida sem deixar claro que está evitando-a.");
  }

  const objectiveFit = spec.reasoning.trim().length > 0;
  if (!objectiveFit) notes.push("Reasoning vazio — não é possível avaliar adequação ao objetivo.");

  const coherent = mechanicFitsPattern && shotSequenceFeasible && productTruthRespected && objectiveFit;

  let verdict: CreativeEvaluation["verdict"] = "pass";
  if (!productTruthRespected) verdict = "fail";
  else if (!coherent) verdict = "warning";

  return {
    coherent,
    mechanicFitsPattern,
    shotSequenceFeasible,
    productTruthRespected,
    objectiveFit,
    verdict,
    notes,
  };
}
