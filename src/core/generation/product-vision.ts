import { z } from "zod";
import { callStructuredVisionFromDataUrls } from "../../lib/openai";

const SYSTEM = `Você descreve um produto a partir de uma foto real enviada pelo usuário, pra virar
informação confiável de produto (não uma característica inventada).

Descreva SÓ o que está literalmente visível na imagem — tipo de item, material aparente, cor,
formato, embalagem, texto/marca visível no produto, estado de uso (novo, embalado). NUNCA
invente benefício, característica funcional, ingrediente ou resultado que não dá pra confirmar
só olhando a foto — isso é uma observação visual, não uma alegação de eficácia.`;

const ResultSchema = z.object({
  visualDescription: z.string(),
});

/** Deriva uma descrição visual real do produto a partir da foto enviada —
 * vira uma EvidencedClaim kind "inferencia" (observação visual, não fato
 * declarado pelo usuário), usada pelo Roteirista/recomendação de formato. */
export async function analyzeProductImage(imageDataUrl: string): Promise<string> {
  const result = await callStructuredVisionFromDataUrls({
    schema: ResultSchema,
    system: SYSTEM,
    prompt: "Descreva o que está literalmente visível nesta foto de produto.",
    images: [imageDataUrl],
    toolName: "product_visual_description",
  });

  return result.visualDescription;
}
