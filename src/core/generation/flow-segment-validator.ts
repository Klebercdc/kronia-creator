import type { FlowSegment, ScriptScene } from "../../types/pipeline";

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Checagem DETERMINÍSTICA (código, não confiança na LLM) de que os
 * flowSegments formam uma sequência de blocos de 10s exata, sequencial,
 * sem gap nem sobreposição — a instrução no prompt do Cinematográfico
 * pede isso, mas só a instrução não garante (a LLM já errou contagem/
 * limites em teste real). Retorna uma lista de problemas em texto (vazia
 * se tudo ok) — nunca "conserta" o número sozinha, só descreve o que está
 * errado pra uma correção estruturada de 1 tentativa.
 */
export function validateSegmentTiming(segments: FlowSegment[], totalSeconds: number): string[] {
  const issues: string[] = [];

  if (totalSeconds % 10 !== 0) {
    // ContentRequest.targetDurationSeconds já é multipleOf(10) — se a duração
    // real das cenas (soma de endSeconds) não bater múltiplo de 10, é a
    // GERAÇÃO anterior (Roteirista) que desviou, não um caso legítimo de
    // "último bloco mais curto". Sem exceção arquitetural pra isso: sinaliza
    // e segue validando os blocos de exatos 10s como sempre.
    issues.push(`Duração total das cenas (${totalSeconds}s) não é múltiplo de 10s — todo flowSegment deve ser um bloco de exatos 10s, sem exceção pro último.`);
  }

  const indexCounts = new Map<number, number>();
  for (const seg of segments) {
    indexCounts.set(seg.index, (indexCounts.get(seg.index) ?? 0) + 1);
  }
  for (const [idx, count] of indexCounts) {
    if (count > 1) {
      issues.push(`Índice ${idx} aparece ${count} vezes nos flowSegments — índices duplicados não são permitidos.`);
    }
  }

  const sorted = [...segments].sort((a, b) => a.index - b.index);
  const expectedCount = Math.round(totalSeconds / 10) || 1;

  if (sorted.length !== expectedCount) {
    issues.push(
      `Esperado ${expectedCount} flowSegments para ${totalSeconds}s totais (blocos de exatos 10s), mas vieram ${sorted.length}.`,
    );
  }

  sorted.forEach((seg, i) => {
    if (seg.index !== i) {
      issues.push(`flowSegment na posição ${i} tem index=${seg.index}, deveria ser ${i} (sequência 0..n-1 sem pular, em ordem).`);
    }

    const expectedStart = i === 0 ? 0 : sorted[i - 1].endSeconds;
    if (seg.startSeconds !== expectedStart) {
      issues.push(
        `flowSegment index ${seg.index}: startSeconds=${seg.startSeconds}, deveria ser ${expectedStart} (sem gap/sobreposição com o segmento anterior).`,
      );
    }

    const actualDuration = seg.endSeconds - seg.startSeconds;
    if (actualDuration !== 10) {
      issues.push(`flowSegment index ${seg.index}: duração=${actualDuration}s, deveria ser exatamente 10s.`);
    }
  });

  const last = sorted[sorted.length - 1];
  if (last && last.endSeconds !== totalSeconds) {
    issues.push(
      `Último flowSegment termina em ${last.endSeconds}s, deveria terminar exatamente em ${totalSeconds}s (duração total do roteiro).`,
    );
  }

  return issues;
}

/**
 * Checagem DETERMINÍSTICA de que "narrativeFunction" segue a estrutura
 * gancho→desenvolvimento→cta quando a duração total é múltiplo de 30s —
 * puramente ORDINAL (1º bloco de 10s = gancho, último = cta, todos os do
 * meio = desenvolvimento), nunca um split rígido de tempo/palavras.
 * Fora desse caso (duração não múltipla de 30s) não há regra a checar.
 */
export function validateNarrativeFunction(segments: FlowSegment[], totalSeconds: number): string[] {
  if (totalSeconds <= 0 || totalSeconds % 30 !== 0) return [];

  const issues: string[] = [];
  const sorted = [...segments].sort((a, b) => a.index - b.index);

  sorted.forEach((seg, i) => {
    const isFirst = i === 0;
    const isLast = i === sorted.length - 1;
    const expected = isFirst ? "gancho" : isLast ? "cta" : "desenvolvimento";
    if (seg.narrativeFunction !== expected) {
      issues.push(
        `flowSegment index ${seg.index}: narrativeFunction="${seg.narrativeFunction}", deveria ser "${expected}" (duração total ${totalSeconds}s é múltiplo de 30s — 1º bloco=gancho, meio=desenvolvimento, último=cta).`,
      );
    }
  });

  return issues;
}

/**
 * Checagem DETERMINÍSTICA de que "customHeroShotFormulaLabel" só existe
 * exatamente quando heroShotFormula==="custom" — não valida se o rótulo em
 * si é "específico o bastante" (isso é julgamento semântico, fora do que
 * código consegue garantir com segurança), só que a decisão estruturada
 * (qual fórmula, custom ou não) realmente foi tomada e está coerente.
 */
export function validateHeroShotFormulas(segments: FlowSegment[]): string[] {
  const issues: string[] = [];

  for (const seg of segments) {
    const hasLabel = !!seg.customHeroShotFormulaLabel && seg.customHeroShotFormulaLabel.trim().length > 0;

    if (seg.heroShotFormula === "custom" && !hasLabel) {
      issues.push(
        `flowSegment index ${seg.index}: heroShotFormula="custom" mas customHeroShotFormulaLabel está vazio/null — toda fórmula custom precisa de um nome/descrição curta.`,
      );
    }

    if (seg.heroShotFormula !== "custom" && hasLabel) {
      issues.push(
        `flowSegment index ${seg.index}: customHeroShotFormulaLabel="${seg.customHeroShotFormulaLabel}" preenchido mas heroShotFormula="${seg.heroShotFormula}" (só deveria ter label quando heroShotFormula==="custom").`,
      );
    }
  }

  return issues;
}

function speechOf(segment: FlowSegment, scenes: ScriptScene[]): string {
  return segment.sceneIndexes
    .map((idx) => scenes.find((s) => s.index === idx)?.narration ?? "")
    .join(" ");
}

/**
 * Checagem DETERMINÍSTICA de que cada "trigger" do gestureMap é um trecho
 * REAL da fala (narration) das cenas cobertas por aquele flowSegment — não
 * aceita gatilho inventado/genérico ("momento importante") que não existe
 * na fala de verdade. Normalização de caixa/acento (mesmo padrão de
 * teologo.ts), sem qualquer análise semântica — é checagem de substring,
 * nada além disso.
 */
export function validateGestureMap(segments: FlowSegment[], scenes: ScriptScene[]): string[] {
  const issues: string[] = [];

  for (const seg of segments) {
    const speech = normalizeForMatch(speechOf(seg, scenes));

    for (const entry of seg.gestureMap) {
      const trigger = entry.trigger.trim();
      if (!trigger) {
        issues.push(`flowSegment index ${seg.index}: gestureMap tem entrada com "trigger" vazio.`);
        continue;
      }
      if (!speech.includes(normalizeForMatch(trigger))) {
        issues.push(
          `flowSegment index ${seg.index}: gestureMap trigger "${entry.trigger}" não aparece na fala das cenas deste bloco (sceneIndexes=${JSON.stringify(seg.sceneIndexes)}) — gesto sem gatilho verbal real.`,
        );
      }
    }
  }

  return issues;
}

/**
 * Remove (não reescreve, não chama LLM) as entradas de gestureMap cujo
 * trigger não corresponde a nenhum trecho real da fala — mesma filosofia
 * do "pode ficar []" já documentada no prompt do Cinematográfico: melhor
 * nenhum gesto do que um gesto com gatilho inventado. Diferente de
 * validateSegmentTiming/validateNarrativeFunction (que apontam pra uma
 * correção estruturada de 1 tentativa), aqui a correção é sempre
 * determinística — não existe "conserto" plausível por LLM pra um gatilho
 * que não existe na fala, só remover.
 */
export function sanitizeGestureMap(segments: FlowSegment[], scenes: ScriptScene[]): FlowSegment[] {
  return segments.map((seg) => {
    const speech = normalizeForMatch(speechOf(seg, scenes));
    const validGestures = seg.gestureMap.filter((entry) => {
      const trigger = entry.trigger.trim();
      return trigger.length > 0 && speech.includes(normalizeForMatch(trigger));
    });
    if (validGestures.length === seg.gestureMap.length) return seg;
    return { ...seg, gestureMap: validGestures };
  });
}

export function validateFlowSegments(segments: FlowSegment[], totalSeconds: number): string[] {
  return [
    ...validateSegmentTiming(segments, totalSeconds),
    ...validateNarrativeFunction(segments, totalSeconds),
    ...validateHeroShotFormulas(segments),
  ];
}
