import { z } from "zod";
import { callStructuredVisionFromDataUrls } from "../../lib/openai";

const SYSTEM = `Você descreve um produto a partir de uma foto real enviada pelo usuário, pra virar
informação confiável de produto (não uma característica inventada).

Descreva SÓ o que está literalmente visível na imagem — tipo de item, material aparente, cor,
formato, embalagem, texto/marca visível no produto, estado de uso (novo, embalado). NUNCA
invente benefício, característica funcional, ingrediente ou resultado que não dá pra confirmar
só olhando a foto — isso é uma observação visual, não uma alegação de eficácia.

REGRA DE QUALIDADE — precisão específica, não descrição vaga:
Depois de descrever, pergunte: essa descrição serviria pra qualquer produto parecido, ou só pra
ESTE aqui especificamente? Nunca troque especificidade por invenção — se um detalhe não está
claro na foto, diga que não está claro, não arredonde pra uma descrição genérica só pra soar
completa.`;

const ResultSchema = z.object({
  visualDescription: z.string(),
});

/** Deriva uma descrição visual real do produto a partir das fotos enviadas —
 * vira uma EvidencedClaim kind "inferencia" (observação visual, não fato
 * declarado pelo usuário), usada pelo Roteirista/recomendação de formato.
 * Aceita mais de uma foto (ex: frente, verso, rótulo) numa chamada só — o
 * modelo vê todas juntas e escreve uma descrição combinada, em vez de N
 * chamadas separadas e desconectadas. */
export async function analyzeProductImage(imageDataUrls: string[]): Promise<string> {
  const result = await callStructuredVisionFromDataUrls({
    schema: ResultSchema,
    system: SYSTEM,
    prompt:
      imageDataUrls.length > 1
        ? "Descreva o que está literalmente visível nestas fotos do mesmo produto (ângulos/lados diferentes)."
        : "Descreva o que está literalmente visível nesta foto de produto.",
    images: imageDataUrls,
    toolName: "product_visual_description",
  });

  return result.visualDescription;
}
