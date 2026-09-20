import "../lib/error-serialization";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateBlocosVendaFields, type BlocosVendaFields } from "../core/generation/blocos-venda-vision";

/**
 * RPC que lê a(s) foto(s) do avatar+produto e devolve os 14 campos do
 * gerador de blocos de venda já preenchidos pela IA — pra quem não quer
 * digitar nada, só anexar a foto (aceita mais de uma, ex: avatar + produto
 * em fotos separadas).
 */
export const generateBlocosVendaFieldsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        imageDataUrls: z.array(z.string().min(1)).min(1).max(4),
        contexto: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<BlocosVendaFields> => generateBlocosVendaFields(data.imageDataUrls, data.contexto));
