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

/** Trend Interpreter — 1 chamada LLM (Groq), síncrona. Não é trabalho
 * pesado o suficiente pra passar pelo Job Engine (isso existe pra
 * download+ffmpeg+Whisper+visão da Ingestão de vídeo, não pra uma
 * interpretação de texto). */
export async function interpretTrend(input: TrendInput): Promise<TrendAnalysis> {
  const prompt = `Tendência informada pelo criador: "${input.trendText}"
${input.growthHint ? `Indicativo de crescimento (não verificado, só contexto): ${input.growthHint}` : ""}
Nicho do criador: ${input.niche}
Objetivo do criador: ${input.objective}

Interprete essa tendência.`;

  return callStructured({
    schema: TrendAnalysisSchema,
    system: SYSTEM,
    prompt,
    toolName: "trend_analysis",
  });
}
