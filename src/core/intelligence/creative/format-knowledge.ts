import type { ContentFormat } from "../../../types/taxonomy";
import type { CreativePattern, VisualMechanic } from "./schemas";

/**
 * Format Intelligence — conhecimento estruturado por CONTENT_FORMAT
 * (reaproveita o enum já existente em taxonomy.ts, não cria uma segunda
 * enumeração). Consultado pelo Creative Reasoning (reasoning.ts) e pelo
 * Prompt QC (qc.ts) — nunca um LLM agent por formato.
 *
 * FORMAT (isto aqui) != CREATIVE PATTERN != VISUAL MECHANIC — cada formato
 * só sugere quais padrões/mecânicas costumam combinar com ele, nunca decide
 * sozinho por eles.
 */
export interface FormatKnowledge {
  purpose: string;
  typicalPatterns: CreativePattern[];
  compatibleMechanics: VisualMechanic[];
  pacing: "lento" | "medio" | "rapido";
  minShots: number;
  maxShots: number;
}

export const FORMAT_KNOWLEDGE: Partial<Record<ContentFormat, FormatKnowledge>> = {
  unboxing: {
    purpose: "Mostrar a primeira abertura/contato com o produto, gerando curiosidade e antecipação.",
    typicalPatterns: ["unboxing", "discovery", "reveal"],
    compatibleMechanics: ["unboxing", "door_to_table", "package_reveal", "bag_reveal", "detail_reveal", "product_rotation"],
    pacing: "medio",
    minShots: 3,
    maxShots: 6,
  },
  ugc: {
    purpose: "Simular conteúdo autêntico de criador/usuário real, baixa produção aparente.",
    typicalPatterns: ["demonstration", "problem_solution", "first_use", "reaction"],
    compatibleMechanics: ["functional_demo", "pov_use", "hand_feel", "reaction", "walk_and_talk", "close_up_detail"],
    pacing: "rapido",
    minShots: 2,
    maxShots: 5,
  },
  pov: {
    purpose: "Câmera na perspectiva do usuário — imersão na experiência de uso.",
    typicalPatterns: ["first_use", "demonstration"],
    compatibleMechanics: ["pov_use", "hand_feel"],
    pacing: "medio",
    minShots: 1,
    maxShots: 4,
  },
  tutorial: {
    purpose: "Ensinar passo a passo como usar o produto.",
    typicalPatterns: ["demonstration", "problem_solution"],
    compatibleMechanics: ["functional_demo", "pov_use"],
    pacing: "medio",
    minShots: 3,
    maxShots: 8,
  },
  demonstracao: {
    purpose: "Provar a função do produto em ação.",
    typicalPatterns: ["prove_the_product", "demonstration"],
    compatibleMechanics: ["functional_demo", "comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 6,
  },
  antes_e_depois: {
    purpose: "Contrastar estado inicial e resultado, sem prometer resultado não evidenciado.",
    typicalPatterns: ["before_after", "transformation"],
    compatibleMechanics: ["before_after", "comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 4,
  },
  review: {
    purpose: "Opinião/avaliação sobre o produto, tom de recomendação pessoal.",
    typicalPatterns: ["social_proof", "reaction"],
    compatibleMechanics: ["reaction", "hand_feel", "comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
  },
  comparacao: {
    purpose: "Comparar o produto com alternativa(s), sem inventar dado do concorrente.",
    typicalPatterns: ["comparison"],
    compatibleMechanics: ["comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
  },
  produto_em_uso: {
    purpose: "Produto sendo usado em contexto real, sem discurso de venda explícito.",
    typicalPatterns: ["demonstration", "first_use"],
    compatibleMechanics: ["functional_demo", "pov_use"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
  },
  teste: {
    purpose: "Submeter o produto a um teste visível e verificável.",
    typicalPatterns: ["prove_the_product", "demonstration"],
    compatibleMechanics: ["functional_demo", "comparison"],
    pacing: "rapido",
    minShots: 2,
    maxShots: 5,
  },
  storytelling: {
    purpose: "Narrativa emocional em torno do produto, não um catálogo de features.",
    typicalPatterns: ["discovery", "transformation", "reaction"],
    compatibleMechanics: ["reaction", "pov_use"],
    pacing: "lento",
    minShots: 3,
    maxShots: 7,
  },
  produto_360: {
    purpose: "Rotação/visão completa do produto — foco em design/acabamento.",
    typicalPatterns: ["discovery", "reveal"],
    compatibleMechanics: ["product_rotation", "detail_reveal"],
    pacing: "lento",
    minShots: 1,
    maxShots: 3,
  },
  apresentacao_por_modelo: {
    purpose: "Modelo/pessoa apresentando o produto diretamente à câmera.",
    typicalPatterns: ["demonstration", "social_proof"],
    compatibleMechanics: ["try_on", "hand_feel", "functional_demo"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
  },
  cinematografico: {
    purpose: "Produção de alta direção visual, estética elevada acima de demonstração literal.",
    typicalPatterns: ["reveal", "discovery"],
    compatibleMechanics: ["product_rotation", "detail_reveal"],
    pacing: "lento",
    minShots: 2,
    maxShots: 6,
  },
  product_showcase: {
    purpose: "Vitrine do produto, foco visual puro sem narrativa de uso.",
    typicalPatterns: ["reveal", "discovery"],
    compatibleMechanics: ["product_rotation", "detail_reveal"],
    pacing: "medio",
    minShots: 1,
    maxShots: 4,
  },

  product_demo: {
    purpose: "Demonstração orientada ao produto, com ação visual como prova do que é realmente observável.",
    typicalPatterns: ["demonstration", "prove_the_product", "hook_demo_payoff", "result_first_demonstration"],
    compatibleMechanics: ["functional_demo", "follow_hands", "close_up_detail", "product_rotation"],
    pacing: "rapido",
    minShots: 2,
    maxShots: 6,
  },
  product_reveal: {
    purpose: "Revelação progressiva do produto, usando descoberta visual sem inventar atributos.",
    typicalPatterns: ["reveal", "discovery", "receive_open_reveal_showcase"],
    compatibleMechanics: ["package_reveal", "door_to_table", "pocket_reveal", "bag_reveal"],
    pacing: "medio",
    minShots: 2,
    maxShots: 6,
  },
  try_on: {
    purpose: "Apresentar uma peça em uso e sua aparência por meio de interação natural.",
    typicalPatterns: ["transformation", "before_after", "reaction_demo_payoff"],
    compatibleMechanics: ["try_on", "comparison", "mirror_showcase"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
  },
  walk_and_talk: {
    purpose: "UGC em movimento com fala direta e integração orgânica do produto.",
    typicalPatterns: ["problem_solution", "story_discovery_product", "hook_demo_payoff"],
    compatibleMechanics: ["walk_and_talk", "reaction", "follow_hands"],
    pacing: "rapido",
    minShots: 2,
    maxShots: 5,
  },
  mirror: {
    purpose: "Apresentação em espelho com foco em aparência, proporção e detalhes visíveis.",
    typicalPatterns: ["discovery", "reveal", "transformation"],
    compatibleMechanics: ["mirror_showcase", "product_rotation", "close_up_detail"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
  },
  hands_only: {
    purpose: "Demonstração conduzida apenas pelas mãos, mantendo atenção na interação e no produto.",
    typicalPatterns: ["demonstration", "discovery", "result_first_demonstration"],
    compatibleMechanics: ["follow_hands", "close_up_detail", "functional_demo"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
  },
};
