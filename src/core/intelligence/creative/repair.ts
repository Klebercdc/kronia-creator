import { callStructuredText } from "../../../lib/openai";
import { CreativeSpecSchema, type CreativeSpec } from "./schemas";

const InferredSchema = CreativeSpecSchema.omit({ version: true, productTruth: true });

const SYSTEM = `Você corrige uma Creative Spec (execução visual de um produto) que foi reprovada no
Prompt QC. Para cada problema listado, aplique a correção mínima necessária — não reescreva a spec
inteira, não mude o produto/formato a menos que o problema exija isso.

Problemas típicos e como corrigir:
- "shot overload" (shot com ações demais pra duração curta): divida em mais shots ou simplifique a
  ação daquele shot pra uma única ação central.
- "duração não bate": ajuste durationSeconds dos shots pra somar exatamente totalDurationSeconds.
- "claim não suportada" / característica desconhecida aparecendo como se fosse fato: remova ou
  reformule qualquer menção a isso na direção/reasoning, sem inventar substituto.
- capability não suportada pelo target (ex. diálogo pedido mas target não suporta áudio nativo):
  remova o diálogo ou marque hasDialogue:false.

Mantenha tudo o mais igual possível ao original.`;

/**
 * Repair — reasoning direcionado (1 chamada LLM), teto de tentativas
 * controlado pelo caller (mesma semântica do Compliance:
 * geração→QC→repair→QC→se ainda falhar, revisão manual explícita, nunca
 * um "pass" mascarado — ver MAX_AUTO_COMPLIANCE_ATTEMPTS em
 * types/compliance.ts, replicado aqui como CREATIVE_QC_MAX_ATTEMPTS).
 */
export async function repairCreativeSpec(spec: CreativeSpec, issues: string[]): Promise<CreativeSpec> {
  const prompt = `Creative Spec atual:\n${JSON.stringify(spec, null, 2)}\n\nProblemas do Prompt QC a corrigir:\n${JSON.stringify(issues, null, 2)}`;

  const inferred = await callStructuredText({
    schema: InferredSchema,
    system: SYSTEM,
    prompt,
    toolName: "creative_spec_repair",
  });

  return {
    ...inferred,
    version: "v1" as const,
    productTruth: spec.productTruth,
  };
}
