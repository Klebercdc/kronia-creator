import { z } from "zod";
import { callStructuredVisionFromDataUrls } from "../../lib/openai";

const SYSTEM = `Você descreve a aparência de uma pessoa/personagem numa foto, pra travar essa
descrição como referência de consistência visual em outros vídeos gerados por IA.

Descreva SÓ o que está literalmente visível na imagem — tom de pele, cor e estilo de cabelo,
barba (se houver), formato de rosto, roupa/vestimenta visível, expressão. Não invente traço que
não dá pra confirmar pela foto, não embeleze, não generalize. O objetivo é que outro gerador de
vídeo consiga reproduzir essa mesma aparência, não uma versão "parecida".`;

const ResultSchema = z.object({
  appearanceDescription: z.string(),
});

/** Deriva a descrição de aparência do ator principal a partir de uma foto de
 * referência real, em vez de depender só do que o usuário digitar de memória. */
export async function analyzeActorImage(imageDataUrl: string): Promise<string> {
  const result = await callStructuredVisionFromDataUrls({
    schema: ResultSchema,
    system: SYSTEM,
    prompt: "Descreva a aparência desta pessoa/personagem em detalhe.",
    images: [imageDataUrl],
    toolName: "actor_appearance",
  });

  return result.appearanceDescription;
}
