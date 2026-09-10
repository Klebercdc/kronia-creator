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
