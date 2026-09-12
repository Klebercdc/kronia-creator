import type { CreativeSpec, SpecialistImplementation, TargetProfile } from "./schemas";

/** Creative Spec + ajustes/constraints específicos do target resolvido —
 * o Prompt Compiler consome isso, não o CreativeSpec puro. */
export interface TargetSpecificSpec {
  spec: CreativeSpec;
  targetConstraints: string[];
}

export type TargetSpecialist = (spec: CreativeSpec, profile: TargetProfile) => TargetSpecificSpec;

/**
 * Fase 1: todos os specialists são funções determinísticas puras
 * (specialistImplementation:"deterministic" em cada TargetProfile) — nenhum
 * LLM agent por target. O contrato (TargetSpecialist) permite que um
 * target futuro precise de reasoning próprio; a decisão fica documentada
 * por target no registry, nunca assumida global (item 4 do adendo final).
 */
function genericModelSpecialist(spec: CreativeSpec, profile: TargetProfile): TargetSpecificSpec {
  const constraints: string[] = [];
  for (const capability of Object.keys(profile.capabilities)) {
    if (profile.capabilities[capability] === "unknown") {
      constraints.push(`Capability "${capability}" não verificada para ${profile.name} — não assumir suporte.`);
    }
  }
  return { spec, targetConstraints: constraints };
}

/**
 * Flow specialist: gera as constraints genéricas a partir do PRÓPRIO dict
 * de capabilities do Flow em target-profiles.ts (não existe herança
 * automática via `basedOn` em lugar nenhum do código — `basedOn` é só
 * metadado arquitetural), e adiciona a nota de que Flow monta a cena numa
 * timeline (SceneBuilder) — relevante quando o Shot Pattern tem mais de 1
 * shot, já que Flow permite encadear clipes de um jeito que um prompt cru
 * pro Veo não descreve sozinho.
 */
function flowSpecialist(spec: CreativeSpec, profile: TargetProfile): TargetSpecificSpec {
  const { targetConstraints } = genericModelSpecialist(spec, profile);
  if (spec.shotPattern.shots.length > 1) {
    targetConstraints.push(
      "Múltiplos shots: montar como clipes conectados na timeline do Flow (SceneBuilder), não como um único prompt monolítico.",
    );
  }
  return { spec, targetConstraints };
}

const SPECIALISTS: Record<string, TargetSpecialist> = {
  veo: genericModelSpecialist,
  flow: flowSpecialist,
  kling: genericModelSpecialist,
};

export function resolveSpecialist(targetId: string): TargetSpecialist {
  return SPECIALISTS[targetId] ?? genericModelSpecialist;
}

/** Só documentação — a implementação real de cada specialist já está
 * declarada em TargetProfile.specialistImplementation; isto aqui é um
 * lembrete em código de que a função acima deve bater com o registry. */
export const _ALL_SPECIALISTS_ARE: SpecialistImplementation = "deterministic";
