import { callStructured } from "../../../lib/llm";
import { TrendAnalysisSchema, type TrendAnalysis, type TrendInput } from "./schemas";

const SYSTEM = `Você interpreta uma tendência de conteúdo (assunto/tema que está crescendo em
popularidade) pra um criador de conteúdo — não gera ideia de vídeo ainda, só explica o
FENÔMENO: sobre o que é, por que provavelmente está crescendo, que intenção o público tem
com esse assunto, e se isso tem relação real com o nicho e objetivo do criador.

Nunca invente número, percentual ou estatística que não foi fornecida. "commercialRelevance",
"contentRelevance" e "trendStrength" são sempre avaliações qualitativas suas (alta/media/baixa),
nunca uma probabilidade — você não tem dado real de performance por trás disso, só está
julgando pela informação textual dada.

Se a tendência não tiver relação nenhuma com o nicho do criador, diga isso claramente em vez
de forçar uma conexão que não existe.`;

/** Trend Interpreter — 1 chamada LLM (Groq), síncrona. Só roda quando o
 * criador informou uma tendência (agora é contexto opcional — a entrada
 * principal virou o produto, ver TrendInputSchema); sem tendência, não há
 * o que interpretar, e o caller nem chama esta função (economiza uma
 * chamada de LLM). Não é trabalho pesado o suficiente pra passar pelo Job
 * Engine (isso existe pra download+ffmpeg+Whisper+visão da Ingestão de
 * vídeo, não pra uma interpretação de texto). */
export async function interpretTrend(input: TrendInput & { trendText: string }): Promise<TrendAnalysis> {
  const prompt = `Tendência informada pelo criador: "${input.trendText}"
${input.growthHint ? `Indicativo de crescimento (não verificado, só contexto): ${input.growthHint}` : ""}
Nicho do criador: ${input.niche}
Objetivo do criador: ${input.objective}
Produto que o criador quer vender: ${input.product}

Interprete essa tendência — inclusive se ela tem relação real com esse produto específico, não só com o nicho em geral.`;

  return callStructured({
    schema: TrendAnalysisSchema,
    system: SYSTEM,
    prompt,
    toolName: "trend_analysis",
  });
}
