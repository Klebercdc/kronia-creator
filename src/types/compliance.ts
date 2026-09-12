import { z } from "zod";

/**
 * Compliance é um GATE de validação, não um prompt final. Regras agrupadas,
 * versionadas e editáveis — nunca hardcoded num único prompt.
 */

export const RULE_GROUPS = [
  "regras_tiktok",
  "tiktok_shop",
  "publicidade_comercial",
  "claims_produto",
  "conteudo_religioso",
  "linguagem_proibida",
  "afirmacoes_absolutas",
  "promessas_nao_comprovadas",
  /** Vídeo de referência: mecânica pode ser adaptada, conteúdo literal não */
  "originalidade_anti_copia",
  /** Marca de terceiro, personagem, música ou conceito de campanha existente — risco de IP */
  "propriedade_intelectual",
] as const;
export const RuleGroupSchema = z.enum(RULE_GROUPS);
export type RuleGroup = z.infer<typeof RuleGroupSchema>;

export const ComplianceViolationSchema = z.object({
  group: RuleGroupSchema,
  flaggedText: z.string(),
  reason: z.string(),
  suggestion: z.string(),
});
export type ComplianceViolation = z.infer<typeof ComplianceViolationSchema>;

/** Teto de correção automática — depois disso escala para edição manual, nunca loop infinito. */
export const MAX_AUTO_COMPLIANCE_ATTEMPTS = 2;

export const ComplianceResultSchema = z.object({
  approved: z.boolean(),
  checkedGroups: z.array(RuleGroupSchema),
  violations: z.array(ComplianceViolationSchema),
  attempt: z.number().int().nonnegative(),
});
export type ComplianceResult = z.infer<typeof ComplianceResultSchema>;
