import "../lib/error-serialization";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateBlocosVendaFields, type BlocosVendaFields } from "../core/generation/blocos-venda-vision";

/**
 * RPC que lê a(s) foto(s) do avatar+produto e devolve os campos do
 * gerador de blocos de venda já preenchidos pela IA — pra quem não quer
 * digitar nada, só anexar a foto (aceita mais de uma, ex: avatar + produto
 * em fotos separadas). `variant` escolhe a duração (curto/padrao/longo) —
 * padrão "padrao", igual ao comportamento de sempre.
 */
export const generateBlocosVendaFieldsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        imageDataUrls: z.array(z.string().min(1)).min(1).max(4),
        contexto: z.string().max(4000).optional(),
        variant: z.enum(["curto", "padrao", "longo"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<BlocosVendaFields> => {
    try {
      return await generateBlocosVendaFields(data.imageDataUrls, data.contexto, data.variant);
    } catch (error) {
      console.error("[KRONIA] generateBlocosVendaFields failed", {
        name: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  });
