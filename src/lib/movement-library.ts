import rawEntries from "../data/movement-library.json";

/**
 * Biblioteca de movimentos pra montar prompt de vídeo (Flow/Veo3) por
 * seleção múltipla — extraída de prompt-vanmax-vv.lovable.app. Cada entrada
 * é um gesto isolado (ex: "mão no cabelo") com duração e instrução prontos;
 * a usuária escolhe vários dentro de uma categoria e o app concatena em uma
 * cena só. `videoUrl` começa null — populado depois por
 * scripts/generate-movement-videos.mjs (ver esse arquivo pra rodar o lote).
 */
export interface MovementEntry {
  id: string;
  group: number;
  category: string;
  categorySlug: string;
  /** "veo3" = categorias já escritas na convenção de prompt do Veo3/Flow (imagem de referência, câmera fixa); "generic" = as demais. */
  engine: "generic" | "veo3";
  title: string;
  tag: string | null;
  durationSec: number | null;
  body: string;
  videoUrl: string | null;
}

const ENTRIES = rawEntries as MovementEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

/** Formato do vídeo — um eixo diferente de "categoria de roupa", cruza
 * com ela (ex: tem POV de blusa, POV de vestido...). Detectado pelo número
 * do grupo, não pelo texto do rótulo, porque os grupos 18-28 ("Veo3 — X")
 * espelham os grupos 1-11 na mesma ordem mas ALGUNS perderam o prefixo
 * original no título (ex: grupo 8 é "Cena 1 — Hook com outra roupa", o
 * espelho Veo3 é só "Veo3 — Hook com outra roupa", sem o "Cena 1 —") —
 * então comparar por texto classificava esses errado. */
export type MovementFormat = "padrao" | "pov" | "ugc" | "cta" | "sequencia";

export const FORMAT_LABEL: Record<MovementFormat, string> = {
  padrao: "Padrão",
  pov: "POV",
  ugc: "UGC / Selfie",
  cta: "CTA",
  sequencia: "Sequência",
};

function formatOf(group: number): MovementFormat {
  const g = group >= 18 ? group - 17 : group; // Veo3 (18-28) espelha os grupos 1-11
  if (g === 7) return "cta";
  if (g === 8 || g === 9 || g === 11) return "sequencia";
  if (g >= 12 && g <= 15) return "ugc";
  if (g === 16 || g === 17) return "pov";
  return "padrao";
}

export interface MovementCategory {
  slug: string;
  label: string;
  group: number;
  engine: MovementEntry["engine"];
  format: MovementFormat;
  subjectType: SubjectType;
  count: number;
}

export function listMovementCategories(): MovementCategory[] {
  const byGroup = new Map<number, MovementCategory>();
  for (const e of ENTRIES) {
    const existing = byGroup.get(e.group);
    if (existing) {
      existing.count += 1;
    } else {
      byGroup.set(e.group, {
        slug: e.categorySlug,
        label: e.category,
        group: e.group,
        engine: e.engine,
        format: formatOf(e.group),
        subjectType: subjectTypeFor(e),
        count: 1,
      });
    }
  }
  return [...byGroup.values()].sort((a, b) => a.group - b.group);
}

export function listMovementsByCategory(categorySlug: string): MovementEntry[] {
  return ENTRIES.filter((e) => e.categorySlug === categorySlug).sort((a, b) => a.id.localeCompare(b.id));
}

export function getMovementsByIds(ids: string[]): MovementEntry[] {
  const set = new Set(ids);
  return ENTRIES.filter((e) => set.has(e.id));
}

/** "Sujeito" da cena — o guia oficial trata isso como podendo ser uma
 * pessoa OU um objeto (produto), o foco varia por categoria. As categorias
 * "POV — Imagens/Animações" nunca mencionam modelo no texto original (é só
 * a peça sendo puxada do pacote, segurada na mão etc.) — as demais sempre
 * têm uma pessoa. Detectado pelo categorySlug pra não precisar migrar os
 * 228 registros com um campo novo. */
export type SubjectType = "person" | "product";

function subjectTypeFor(entry: MovementEntry): SubjectType {
  return entry.categorySlug.includes("pov") ? "product" : "person";
}

/** Sugestão automática de sujeito pra uma seleção — usada como valor
 * inicial do seletor Avatar/Objeto na tela; a usuária pode trocar antes de
 * gerar (ver `composeMovementPrompt`, parâmetro `subjectTypeOverride`). */
export function detectSubjectType(ids: string[]): SubjectType {
  const types = new Set(getMovementsByIds(ids).map(subjectTypeFor));
  return types.size === 1 ? [...types][0] : "person";
}

const SUBJECT_LINE: Record<SubjectType, string> = {
  person:
    "a mesma pessoa, rosto, roupa e ambiente da foto de referência enviada — manter tudo idêntico à referência do início ao fim, sem deformar mãos",
  product:
    "o mesmo produto e ambiente da foto de referência enviada — manter cor, tecido, costura, proporções e detalhes idênticos à referência, sem deformar a mão que segura o produto",
};

/** Especificação técnica fixa que abre todo prompt composto — segue a
 * estrutura oficial do guia de prompting do Veo 3.1 (Google Cloud Blog,
 * "Ultimate prompting guide for Veo 3.1"): Cinematografia → Sujeito/Contexto
 * → Estilo → restrições. Os movimentos selecionados entram depois como a
 * parte de Ação. A frase de Sujeito muda conforme o(s) tipo(s) dos
 * movimentos escolhidos (pessoa, produto, ou os dois numa mesma seleção).
 *
 * Consistência de personagem/produto: o guia oficial recomenda NÃO tentar
 * descrever o sujeito em texto (isso é o que causa "coisa diferente em cada
 * vídeo") — o jeito certo é subir uma FOTO de referência no Flow junto com
 * o texto (recurso "Ingredients to Video"/imagem de referência). Por isso o
 * texto abaixo sempre aponta pra essa foto em vez de tentar redescrever. */
function buildTechnicalHeader(subjectTypes: Set<SubjectType>): string {
  const subjectSentence =
    subjectTypes.size === 1
      ? SUBJECT_LINE[[...subjectTypes][0]]
      : "a mesma pessoa e/ou o mesmo produto da foto de referência enviada — manter tudo (rosto, roupa, cor, tecido e ambiente) idêntico à referência do início ao fim, sem deformar mãos";

  return (
    "Plano fixo, câmera estável, enquadramento único sem cortes. " +
    `Sujeito e cenário: ${subjectSentence}. ` +
    "Estilo: fotorrealista, iluminação natural, vídeo vertical 9:16. " +
    "Restrições: sem fala, sem legenda, sem texto na tela, sem logo, sem marca d'água."
  );
}

/** Concatena os movimentos selecionados, na ordem em que foram clicados, numa
 * única cena contínua com conectores simples — sem passar por LLM. Soma as
 * durações pra dar uma estimativa de tempo total do clipe.
 *
 * `subjectTypeOverride`: a usuária escolhe explicitamente "Avatar" ou
 * "Objeto" na tela (seletor ao lado da seleção de movimentos) — quando
 * informado, vence a detecção automática por categoria pra toda a seleção,
 * mesmo que os movimentos escolhidos sejam de tipos diferentes. */
export function composeMovementPrompt(
  ids: string[],
  subjectTypeOverride?: SubjectType,
): { text: string; totalDurationSec: number } | null {
  const byId = new Map(getMovementsByIds(ids).map((e) => [e.id, e]));
  const ordered = ids.map((id) => byId.get(id)).filter((e): e is MovementEntry => Boolean(e));
  if (ordered.length === 0) return null;

  // Frases que só repetem instrução técnica já coberta pelo TECHNICAL_HEADER
  // ("Sem fala...", "Câmera fixa...", "Movimento curto, câmera parada...",
  // "Manter a mesma modelo...") — filtradas fora por SENTENÇA inteira, nunca
  // por trecho parcial, pra nunca correr o risco de cortar uma frase que
  // também descreve conteúdo real (ex: "...e sorri pra câmera." fica).
  const BOILERPLATE_SENTENCE = [
    /^Sem fala/i,
    /^Câmera (fixa|parada|tripé|estática)/i,
    /^Movimento[^,]*,\s*câmera/i,
    /^Manter (a mesma modelo|fidelidade)/i,
    /^Preservar identidade/i,
  ];

  function stripBoilerplate(body: string): string {
    const sentences = body.match(/[^.]+\.?/g) ?? [body];
    return sentences
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !BOILERPLATE_SENTENCE.some((re) => re.test(s)))
      .join(" ");
  }

  const connectors = ["Em seguida,", "Depois,", "Na sequência,", "Logo após,", "Para finalizar,"];
  const sentences = ordered.map((entry, idx) => {
    const cleaned = stripBoilerplate(entry.body);
    if (idx === 0) return cleaned;
    const connector = connectors[Math.min(idx - 1, connectors.length - 1)];
    return `${connector} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  });

  const totalDurationSec = ordered.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
  const subjectTypes = subjectTypeOverride ? new Set([subjectTypeOverride]) : new Set(ordered.map(subjectTypeFor));
  const header = buildTechnicalHeader(subjectTypes);
  const text = `${header} Duração total: ~${totalDurationSec} segundos.\n\n${sentences.join(" ")}`;
  return { text, totalDurationSec };
}
