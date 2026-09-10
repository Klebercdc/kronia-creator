import { z } from "zod";

/**
 * Princípio de evidência: nenhuma característica desconhecida pode ser
 * apresentada como fato. Toda afirmação sobre o produto carrega sua origem.
 */

export const EvidenceKindSchema = z.enum(["fato", "inferencia", "sugestao_ia", "desconhecido"]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidencedClaimSchema = z.object({
  text: z.string(),
  kind: EvidenceKindSchema,
  /** De onde veio: "foto do produto", "campo de informações", "vídeo de referência", "modelo" */
  source: z.string(),
});
export type EvidencedClaim = z.infer<typeof EvidencedClaimSchema>;
