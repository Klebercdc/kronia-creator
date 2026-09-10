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
  "conteudo_gerado_por_ia",
  "divulgacao_comercial",
  "linguagem_proibida",
  "afirmacoes_absolutas",
  "promessas_nao_comprovadas",
  /** Vídeo de referência: mecânica pode ser adaptada, conteúdo literal não */
  "originalidade_anti_copia",
] as const;
export type RuleGroup = (typeof RULE_GROUPS)[number];

export interface ComplianceViolation {
  group: RuleGroup;
  flaggedText: string;
  reason: string;
  suggestion: string;
}

export interface ComplianceResult {
  approved: boolean;
  checkedGroups: RuleGroup[];
  violations: ComplianceViolation[];
  /** Zero na primeira passagem; usado para o teto de correção automática (2 tentativas → escalar) */
  attempt: number;
  maxAutoAttempts: 2;
}
