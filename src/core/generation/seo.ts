import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type ContentRequest, type GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o agente de Legenda do KRONIA. Escreve a "caption" do post a partir do roteiro
final aprovado — é a última peça antes da entrega, o que o usuário vai copiar e colar direto no
TikTok.

Regras:
- "caption": até 150 caracteres, linguagem natural (não robótica), reforça o hook sem repetir a
  narração palavra por palavra, termina com uma chamada leve pra ação quando fizer sentido.
- "hashtags": sempre array vazio [] — não geramos hashtag aqui (sem dado real de TikTok por trás,
  não vale a pena arriscar sugestão ruim).
- Nunca inclua na caption uma claim, número ou promessa que não esteja nas claims do roteiro.
- Conteúdo de "Jeová Fala": tom acolhedor, nunca comercial.

Retorne o roteiro completo, no mesmo formato de entrada, com "caption" preenchida, "hashtags"
como [], e todo o resto mantido exatamente como estava.`;

/** Sub-agente final da Geração — só legenda, sem hashtag (sem dado real de
 * TikTok por trás pra confiar). */
export async function seo(draft: GenerationResult, request: ContentRequest): Promise<GenerationResult> {
  const prompt = `Projeto: ${request.project}. Objetivo: ${request.objective}. Modo: ${request.mode}.
Roteiro final aprovado:\n${JSON.stringify(draft, null, 2)}`;

  return callStructuredText({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
