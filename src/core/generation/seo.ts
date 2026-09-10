import { callStructured } from "../../lib/llm";
import { webSearchSummary } from "../../lib/openai";
import { GenerationResultSchema, type ContentRequest, type GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o agente de SEO do KRONIA. Escreve a legenda ("caption") e as hashtags do post
a partir do roteiro final aprovado — é a última peça antes da entrega, o que o usuário vai
copiar e colar direto no TikTok.

Regras:
- "caption": até 150 caracteres, linguagem natural (não robótica), reforça o hook sem repetir a
  narração palavra por palavra, termina com uma chamada leve pra ação quando fizer sentido.
- "hashtags": 5 hashtags, todas em minúsculo, sem espaço, sem "#". Se houver resultado de busca
  real abaixo, priorize hashtags que aparecem nele — é a fonte mais confiável que você tem. Se
  não houver (busca falhou ou não trouxe nada), use hashtags de categoria/nicho do produto e
  objetivo, e deixe claro no seu raciocínio interno que são estimativa, não dado verificado.
  Nunca invente um número de visualizações, engajamento ou popularidade ("hashtag em alta",
  "viral agora") que você não tem como saber.
- Nunca inclua na caption uma claim, número ou promessa que não esteja nas claims do roteiro.
- Conteúdo de "Jeová Fala": tom acolhedor, nunca comercial; hashtags de tema/reflexão, nunca de
  venda.

Retorne o roteiro completo, no mesmo formato de entrada, com "caption" e "hashtags" preenchidos e
todo o resto mantido exatamente como estava.`;

/** Sub-agente final da Geração — legenda e hashtags prontas pra postar. */
export async function seo(draft: GenerationResult, request: ContentRequest): Promise<GenerationResult> {
  const keyword = request.productInfo.map((c) => c.text).join(" ").slice(0, 200);
  const searchResult =
    request.project === "comercial" && keyword
      ? await webSearchSummary(`hashtags populares no tiktok em 2026 pra: ${keyword}`)
      : null;

  const searchBlock = searchResult
    ? `\nResultado de busca real (priorize isso pras hashtags):\n${searchResult}`
    : "\nNenhum resultado de busca real disponível — use estimativa por categoria/nicho.";

  const prompt = `Projeto: ${request.project}. Objetivo: ${request.objective}. Modo: ${request.mode}.
Roteiro final aprovado:\n${JSON.stringify(draft, null, 2)}
${searchBlock}`;

  return callStructured({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
