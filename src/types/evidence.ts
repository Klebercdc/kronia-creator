/**
 * Princípio de evidência: nenhuma característica desconhecida pode ser
 * apresentada como fato. Toda afirmação sobre o produto carrega sua origem.
 */

export type EvidenceKind = "fato" | "inferencia" | "sugestao_ia" | "desconhecido";

export interface EvidencedClaim {
  text: string;
  kind: EvidenceKind;
  /** De onde veio: "foto do produto", "campo de informações", "vídeo de referência", "modelo" */
  source: string;
}
