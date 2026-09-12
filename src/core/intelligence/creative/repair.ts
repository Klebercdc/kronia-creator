import { callStructuredText } from "../../../lib/openai";
import { CreativeSpecSchema, type CreativeSpec } from "./schemas";

const InferredSchema = CreativeSpecSchema.omit({ version: true, productTruth: true });

const SYSTEM = `Você corrige uma Creative Spec (execução visual de um produto) que foi reprovada no
Prompt QC. Para cada problema listado, aplique a correção mínima necessária — não reescreva a spec
inteira, não mude o produto/formato a menos que o problema exija isso.

REGRA QUE VALE SEMPRE, MESMO QUANDO NÃO FOR O PROBLEMA LISTADO: a Creative Spec já vem com
"productTruth.unknown" — características do produto que NUNCA podem ser afirmadas nem demonstradas
por ação/cena, mesmo sem citar o termo literal (ex.: unknown="resistência a impacto/queda" proíbe
tanto a palavra quanto uma cena de queda com o produto saindo intacto). Ao corrigir QUALQUER outro
problema (shot overload, duração, capability), releia os shots/reasoning resultantes e remova
qualquer demonstração de característica não confirmada que já estivesse ali, mesmo que isso não
tenha sido apontado explicitamente na lista de problemas — a spec corrigida nunca pode manter uma
claim não suportada que a spec original já tinha.

Problemas típicos e como corrigir:
- "shot overload" (shot com ações demais pra duração curta): divida em mais shots ou simplifique a
  ação daquele shot pra uma única ação central.
- "duração não bate": ajuste durationSeconds dos shots pra somar exatamente totalDurationSeconds.
- "claim não suportada" / característica desconhecida aparecendo como se fosse fato: remova ou
  reformule qualquer menção a isso na direção/reasoning, sem inventar substituto.
- capability não suportada pelo target (ex. diálogo pedido mas target não suporta áudio nativo):
  remova o diálogo ou marque hasDialogue:false.

Mantenha tudo o mais igual possível ao original. IMPORTANTE: se media="image", shotPattern deve
continuar null — nunca invente um shot fake pra imagem só porque o campo existe no schema.`;

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
