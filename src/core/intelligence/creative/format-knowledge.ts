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
  incompatibleWith: ContentFormat[];
}

export const FORMAT_KNOWLEDGE: Partial<Record<ContentFormat, FormatKnowledge>> = {
  unboxing: {
    purpose: "Mostrar a primeira abertura/contato com o produto, gerando curiosidade e antecipação.",
    typicalPatterns: ["unboxing", "discovery", "reveal"],
    compatibleMechanics: ["unboxing", "detail_reveal", "product_rotation"],
    pacing: "medio",
    minShots: 3,
    maxShots: 6,
    incompatibleWith: ["antes_e_depois"],
  },
  ugc: {
    purpose: "Simular conteúdo autêntico de criador/usuário real, baixa produção aparente.",
    typicalPatterns: ["demonstration", "problem_solution", "first_use", "reaction"],
    compatibleMechanics: ["functional_demo", "pov_use", "hand_feel", "reaction"],
    pacing: "rapido",
    minShots: 2,
    maxShots: 5,
    incompatibleWith: [],
  },
  pov: {
    purpose: "Câmera na perspectiva do usuário — imersão na experiência de uso.",
    typicalPatterns: ["first_use", "demonstration"],
    compatibleMechanics: ["pov_use", "hand_feel"],
    pacing: "medio",
    minShots: 1,
    maxShots: 4,
    incompatibleWith: [],
  },
  tutorial: {
    purpose: "Ensinar passo a passo como usar o produto.",
    typicalPatterns: ["demonstration", "problem_solution"],
    compatibleMechanics: ["functional_demo", "pov_use"],
    pacing: "medio",
    minShots: 3,
    maxShots: 8,
    incompatibleWith: [],
  },
  demonstracao: {
    purpose: "Provar a função do produto em ação.",
    typicalPatterns: ["prove_the_product", "demonstration"],
    compatibleMechanics: ["functional_demo", "comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 6,
    incompatibleWith: [],
  },
  antes_e_depois: {
    purpose: "Contrastar estado inicial e resultado, sem prometer resultado não evidenciado.",
    typicalPatterns: ["before_after", "transformation"],
    compatibleMechanics: ["before_after", "comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 4,
    incompatibleWith: ["unboxing"],
  },
  review: {
    purpose: "Opinião/avaliação sobre o produto, tom de recomendação pessoal.",
    typicalPatterns: ["social_proof", "reaction"],
    compatibleMechanics: ["reaction", "hand_feel", "comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
    incompatibleWith: [],
  },
  comparacao: {
    purpose: "Comparar o produto com alternativa(s), sem inventar dado do concorrente.",
    typicalPatterns: ["comparison"],
    compatibleMechanics: ["comparison"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
    incompatibleWith: [],
  },
  produto_em_uso: {
    purpose: "Produto sendo usado em contexto real, sem discurso de venda explícito.",
    typicalPatterns: ["demonstration", "first_use"],
    compatibleMechanics: ["functional_demo", "pov_use"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
    incompatibleWith: [],
  },
  teste: {
    purpose: "Submeter o produto a um teste visível e verificável.",
    typicalPatterns: ["prove_the_product", "demonstration"],
    compatibleMechanics: ["functional_demo", "comparison"],
    pacing: "rapido",
    minShots: 2,
    maxShots: 5,
    incompatibleWith: [],
  },
  storytelling: {
    purpose: "Narrativa emocional em torno do produto, não um catálogo de features.",
    typicalPatterns: ["discovery", "transformation", "reaction"],
    compatibleMechanics: ["reaction", "pov_use"],
    pacing: "lento",
    minShots: 3,
    maxShots: 7,
    incompatibleWith: [],
  },
  produto_360: {
    purpose: "Rotação/visão completa do produto — foco em design/acabamento.",
    typicalPatterns: ["discovery", "reveal"],
    compatibleMechanics: ["product_rotation", "detail_reveal"],
    pacing: "lento",
    minShots: 1,
    maxShots: 3,
    incompatibleWith: [],
  },
  apresentacao_por_modelo: {
    purpose: "Modelo/pessoa apresentando o produto diretamente à câmera.",
    typicalPatterns: ["demonstration", "social_proof"],
    compatibleMechanics: ["try_on", "hand_feel", "functional_demo"],
    pacing: "medio",
    minShots: 2,
    maxShots: 5,
    incompatibleWith: [],
  },
  cinematografico: {
    purpose: "Produção de alta direção visual, estética elevada acima de demonstração literal.",
    typicalPatterns: ["reveal", "discovery"],
    compatibleMechanics: ["product_rotation", "detail_reveal"],
    pacing: "lento",
    minShots: 2,
    maxShots: 6,
    incompatibleWith: [],
  },
  product_showcase: {
    purpose: "Vitrine do produto, foco visual puro sem narrativa de uso.",
    typicalPatterns: ["reveal", "discovery"],
    compatibleMechanics: ["product_rotation", "detail_reveal"],
    pacing: "medio",
    minShots: 1,
    maxShots: 4,
    incompatibleWith: [],
  },
};
