import { callStructuredText } from "../../lib/openai";
import { type ContentRequest, type GenerationResult } from "../../types/pipeline";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";
import { RevisionInferredSchema } from "./decision-log";

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

${CREATIVE_QUALITY_BAR}

Retorne o roteiro completo, no mesmo formato de entrada, com "caption" preenchida, "hashtags"
como [], e todo o resto mantido exatamente como estava. Preencha também "decisaoResumo" e
"motivoDecisao" (1 frase cada) explicando a linha editorial da legenda — não precisam de
"alternativasDescartadas".`;

/** Sub-agente final da Geração — só legenda, sem hashtag (sem dado real de
 * TikTok por trás pra confiar). Não acrescenta entrada própria ao
 * decisionLog no fluxo principal (roda sob demanda, fora da cadeia
 * automática) — só preserva o log acumulado como veio. */
export async function seo(draft: GenerationResult, request: ContentRequest): Promise<GenerationResult> {
  const prompt = `Projeto: ${request.project}. Objetivo: ${request.objective}. Modo: ${request.mode}.
Roteiro final aprovado:\n${JSON.stringify(draft, null, 2)}`;

  const { decisaoResumo: _decisaoResumo, motivoDecisao: _motivoDecisao, alternativasDescartadas: _alt, ...rest } =
    await callStructuredText({
      schema: RevisionInferredSchema,
      system: SYSTEM,
      prompt,
      toolName: "generation_result",
    });

  return { ...rest, decisionLog: draft.decisionLog };
}
