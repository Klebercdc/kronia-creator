import "../lib/error-serialization";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toFile } from "openai";
import { getOpenAIClient } from "../lib/openai";

const ImageGenerationInputSchema = z.object({
  prompt: z.string().trim().min(8).max(3_000),
  format: z.enum(["square", "portrait", "landscape"]),
  quantity: z.number().int().min(1).max(4),
  referenceImages: z.array(z.string().regex(/^data:image\/(png|jpeg|webp);base64,/)).max(4),
});

const SIZE_BY_FORMAT = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
} as const;

/** Geração deliberadamente em WebP low para caber no limite de resposta da
 * function mesmo com quatro imagens. O cliente recebe data URLs prontas para
 * prévia e download; nenhuma chave da OpenAI chega ao navegador. */
export const generateImagesFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => ImageGenerationInputSchema.parse(data))
  .handler(async ({ data }) => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Geração de imagens não configurada. Defina OPENAI_API_KEY na Vercel.");
    }

    const options = {
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: data.prompt,
      n: data.quantity,
      size: SIZE_BY_FORMAT[data.format],
      quality: "low",
      output_format: "webp",
      output_compression: 82,
      moderation: "auto",
    } as const;
    const response = data.referenceImages.length
      ? await getOpenAIClient().images.edit({
          ...options,
          image: await Promise.all(data.referenceImages.map(async (dataUrl, index) => {
            const [header, base64] = dataUrl.split(",", 2);
            const mime = header.match(/^data:(image\/(?:png|jpeg|webp));base64$/)?.[1] ?? "image/webp";
            return toFile(Buffer.from(base64, "base64"), `referencia-${index + 1}.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`, { type: mime });
          })),
        })
      : await getOpenAIClient().images.generate(options);

    const images = (response.data ?? []).flatMap((image) =>
      image.b64_json ? [`data:image/webp;base64,${image.b64_json}`] : [],
    );
    if (images.length !== data.quantity) throw new Error("A geração não retornou todas as imagens solicitadas.");
    return { images };
  });
