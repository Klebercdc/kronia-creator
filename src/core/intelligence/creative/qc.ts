import type { CreativeSpec, QcResult, TargetProfile } from "./schemas";
import type { CompiledPrompt } from "./compiler";

const OVERLOAD_ACTIONS_PER_SECOND = 0.5; // >1 ação a cada ~2s já é overload nesta heurística

function countActionClauses(action: string): number {
  return action
    .split(/,| e | then | depois /i)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Verbos/termos de DEMONSTRAÇÃO de propriedade física ou efeito — achado
 * real em auditoria adversarial: o check de substring exata contra
 * `productTruth.unknown` (abaixo) é enganado quando a LLM não cita o termo
 * proibido literalmente, mas NARRA a ação que o comprova (ex.: unknown =
 * "resistência a impacto/queda"; texto gerado descreve uma bola de tênis
 * caindo sobre o produto e o produto saindo intacto — a claim é a MESMA,
 * só que dramatizada em vez de nomeada). Esta lista não substitui o check
 * de substring — é uma segunda rede, mais grosseira de propósito: qualquer
 * shot/reasoning que combine um verbo desta lista com QUALQUER
 * característica ainda não confirmada é tratado como suspeito, mesmo sem
 * bater o texto exato do termo desconhecido. Prefere falso positivo (custa
 * 1 repair) a falso negativo (custa uma claim inventada saindo pro ar). */
const PROPERTY_DEMONSTRATION_SIGNALS = [
  /\bqueda\b/i,
  /\bcai(r|u|ndo)?\b/i,
  /\bimpacto\b/i,
  /\besmaga(r|do)?\b/i,
  /\barremess/i,
  /\batir(a|ar|ada)\b/i,
  /\bcolid/i,
  /\bsubmerg/i,
  /\bmolha(r|do)?\b/i,
  /\bmergulh/i,
  /à prova d[ae]/i,
  /\bestica(r|do)?\b/i,
  /\balonga(r)?\b/i,
  /\bcura(r|do)?\b/i,
  /\btrat[ae]\b/i,
  /\balivia\b/i,
  /energia espiritual/i,
  /prote[cç][aã]o espiritual/i,
  /\bpurifica/i,
];

const NEGATION_WORDS = /\b(sem|não|nunca|jamais|evitando|evita)\b/i;

/**
 * Ignora uma OCORRÊNCIA quando a CLÁUSULA que a contém (texto dividido por
 * `; , .`) tem uma palavra de negação em qualquer ponto da cláusula — ex.:
 * "sem demonstrar queda ou impacto" é uma cláusula só, então tanto "queda"
 * quanto "impacto" saem negados juntos, mesmo com uma palavra no meio
 * ("ou") separando-os. Cláusula (não uma janela fixa de caracteres) porque
 * um teste real mostrou a janela de caracteres falhando: com uma palavra
 * extra entre a negação e o segundo termo, um char-window curto o
 * suficiente pra não pegar negação de verdade em cláusulas longas também
 * não alcançava a negação nesse caso — cláusula é o limite semântico
 * certo, não um número mágico de caracteres.
 *
 * Correção de auditoria: cada padrão é escaneado em TODAS as ocorrências
 * do texto (via `matchAll` com flag "g"), cada uma julgada pela própria
 * cláusula — não só a primeira ocorrência. Bug real encontrado e
 * corrigido: antes, `text.match(pattern)` sem "g" só olhava a primeira
 * ocorrência; se essa primeira viesse negada ("sem demonstrar queda"), o
 * termo inteiro era descartado e uma segunda ocorrência afirmativa mais
 * adiante no mesmo texto, numa cláusula diferente ("...depois ocorre uma
 * queda sobre o produto e ele permanece intacto"), passava batida.
 */
function detectPropertyDemonstration(text: string): string[] {
  const found = new Set<string>();
  const clauseBoundaries: number[] = [0];
  for (const match of text.matchAll(/[;,.]/g)) {
    if (match.index !== undefined) clauseBoundaries.push(match.index + 1);
  }
  clauseBoundaries.push(text.length);

  function clauseContaining(index: number): string {
    for (let i = 0; i < clauseBoundaries.length - 1; i++) {
      if (index >= clauseBoundaries[i] && index < clauseBoundaries[i + 1]) {
        return text.slice(clauseBoundaries[i], clauseBoundaries[i + 1]);
      }
    }
    return text;
  }

  for (const pattern of PROPERTY_DEMONSTRATION_SIGNALS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(globalPattern)) {
      if (match.index === undefined) continue;
      const clause = clauseContaining(match.index);
      if (NEGATION_WORDS.test(clause)) continue;
      found.add(match[0]);
      break; // já achou 1 ocorrência afirmativa deste sinal — não precisa continuar procurando este padrão específico
    }
  }
  return Array.from(found);
}

/**
 * Prompt QC — determinístico, ZERO chamada de LLM. Avalia o PROMPT
 * COMPILADO (depois do compile) — nunca a intenção/CreativeSpec, isso é
 * papel do Creative Evaluation (evaluation.ts), que roda ANTES do compile.
 */
export function runPromptQc(compiled: CompiledPrompt, spec: CreativeSpec, profile: TargetProfile): QcResult {
  const issues: string[] = [];

  if (spec.media === "video" && spec.shotPattern) {
    const sumShots = spec.shotPattern.shots.reduce((acc, s) => acc + s.durationSeconds, 0);
    if (Math.abs(sumShots - spec.shotPattern.totalDurationSeconds) > 0.5) {
      issues.push(
        `Duração dos shots (${sumShots}s) não bate com a duração total declarada (${spec.shotPattern.totalDurationSeconds}s).`,
      );
    }

    spec.shotPattern.shots.forEach((shot, position) => {
      const clauses = countActionClauses(shot.action);
      const maxClauses = Math.max(1, Math.ceil(shot.durationSeconds * OVERLOAD_ACTIONS_PER_SECOND));
      if (clauses > maxClauses) {
        issues.push(
          `Shot ${position + 1} (${shot.durationSeconds}s) tem ${clauses} ações — excesso de ações pra duração curta (shot overload).`,
        );
      }
    });
  }

  if (spec.dialogueSpec?.hasDialogue) {
    const audioCapability = profile.capabilities["audio_native"];
    if (audioCapability === "unsupported") {
      issues.push(`Diálogo pedido, mas "${profile.name}" não suporta áudio nativo (audio_native: unsupported).`);
    }
  }

  for (const unknownTerm of spec.productTruth.unknown) {
    const negativeLine = compiled.negativePrompt ?? "";
    const restOfPrompt = compiled.promptText.replace(/Não mostrar\/afirmar \(desconhecido\):.*$/m, "");
    if (restOfPrompt.toLowerCase().includes(unknownTerm.toLowerCase()) && !negativeLine.toLowerCase().includes(unknownTerm.toLowerCase())) {
      issues.push(`Característica não confirmada "${unknownTerm}" aparece fora da lista de exclusão — possível claim não suportada.`);
    }
  }

  // Segunda rede contra claim não suportada: mesmo quando o termo exato do
  // `unknown` não aparece, uma AÇÃO que DEMONSTRA a propriedade (queda,
  // impacto, cura, energia espiritual etc.) enquanto existe QUALQUER
  // característica ainda não confirmada é tratada como suspeita — ver
  // PROPERTY_DEMONSTRATION_SIGNALS acima para o porquê disso ser necessário.
  //
  // Escopo deliberadamente restrito ao que REALMENTE vai pro prompt final
  // (ações dos shots + director spec) — nunca `spec.reasoning` nem o texto
  // compilado inteiro. Dois motivos, os dois confirmados na prática: (1)
  // `compiler.ts` nunca inclui `spec.reasoning` no prompt compilado — é
  // texto interno só pra explicar a escolha na UI, não é enviado pro
  // gerador de vídeo, então escanear reasoning não protege o artefato real;
  // (2) reasoning é exatamente onde a LLM costuma EXPLICAR que evitou a
  // claim ("evitando demonstrar resistência a impacto..."), o que dispara
  // falso positivo certeiro se for escaneado. A linha "Não mostrar/afirmar
  // (desconhecido): ..." do compiler pelo mesmo motivo fica de fora (ela
  // cita o próprio termo desconhecido por design).
  if (spec.productTruth.unknown.length > 0) {
    const narratedText = [
      ...(spec.shotPattern?.shots.map((s) => s.action) ?? []),
      spec.directorSpec.framing,
      spec.directorSpec.cameraMovement,
      spec.directorSpec.environment,
      spec.directorSpec.continuityNotes,
    ]
      .filter((v): v is string => Boolean(v))
      .join(" ");
    const signals = detectPropertyDemonstration(narratedText);
    if (signals.length > 0) {
      issues.push(
        `Possível claim não suportada demonstrada narrativamente (termos: ${signals.join(", ")}) enquanto existe característica não confirmada (${spec.productTruth.unknown.join("; ")}) — revisar antes de aprovar.`,
      );
    }
  }

  if (issues.length === 0) {
    return { state: "pass", issues: [] };
  }

  const hasHardFailure = issues.some((i) => i.includes("claim não suportada") || i.includes("shot overload"));
  return { state: hasHardFailure ? "repair_required" : "warning", issues };
}
