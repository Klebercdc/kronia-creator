/**
 * Taxonomia fechada e editável. Cresce apenas quando houver evidência de
 * que uma nova categoria é realmente necessária — não expandir por especulação.
 */

export const CONTENT_FORMATS = [
  "product_showcase",
  "ugc",
  "pov",
  "unboxing",
  "tutorial",
  "demonstracao",
  "cinematografico",
  "produto_em_uso",
  "antes_e_depois",
  "review",
  "teste",
  "comparacao",
  "storytelling",
  "produto_360",
  "apresentacao_por_modelo",
] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

/**
 * Baseado em análise real de 34.635 clipes virais (OpusClip, jan–mar 2026) +
 * frameworks de 12 estilos de hook cruzados de múltiplas fontes — não é lista
 * inventada. "result_first" (mostrar produto/resultado nos primeiros 2s) é a
 * categoria de melhor performance isolada.
 */
export const HOOK_TYPES = [
  "curiosity",
  "pattern_interrupt",
  "bold_statement",
  "question",
  "social_proof",
  "before_after",
  "negative_hook",
  "relatable_pain",
  "story_open",
  "result_first",
  "identity_call",
  "number_stat",
] as const;
export type HookType = (typeof HOOK_TYPES)[number];

export const PERSUASION_MECHANISMS = [
  "curiosidade",
  "problema_solucao",
  "beneficio",
  "contraste",
  "desejo",
  "alivio",
  "prova_social",
  "pattern_interrupt",
  "urgencia",
  "cta_claro",
] as const;
export type PersuasionMechanism = (typeof PERSUASION_MECHANISMS)[number];

/**
 * Gatilhos de psicologia de compra — os 7 princípios de Cialdini (Influence,
 * 1984 + Pre-Suasion, 2016: reciprocidade, escassez, autoridade, consistência,
 * afinidade, prova social, pertencimento) + ancoragem/aversão a perda/efeito
 * de enquadramento (Kahneman). Separado de PERSUASION_MECHANISMS porque é uma
 * lente mais específica: vieses cognitivos e princípios comportamentais
 * validados, não técnicas gerais de copy. Todos exigem evidência real por
 * trás (ver EvidenceKind) — nunca aplicados por invenção.
 */
export const BUYING_PSYCHOLOGY_TRIGGERS = [
  "ancoragem",
  "aversao_a_perda",
  "prova_social",
  "reciprocidade",
  "compromisso_e_consistencia",
  "escassez",
  "efeito_enquadramento",
  "vies_de_autoridade",
  "afinidade",
  "pertencimento",
] as const;
export type BuyingPsychologyTrigger = (typeof BUYING_PSYCHOLOGY_TRIGGERS)[number];

export const PACING = ["lento", "medio", "rapido"] as const;
export type Pacing = (typeof PACING)[number];

export const OBJECTIVES = ["vender", "engajar", "educar", "outros"] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const MODES = ["tiktok_shop", "organico"] as const;
export type Mode = (typeof MODES)[number];

/**
 * Decide o vertical editorial — resolve a lacuna que ficou em aberto na
 * arquitetura: o Teólogo só roda quando `project` é "jeova_fala", nunca por
 * inferência automática de conteúdo. Ajustar se o produto virar dois apps
 * separados em vez de um seletor único.
 */
export const PROJECTS = ["comercial", "jeova_fala"] as const;
export type Project = (typeof PROJECTS)[number];
