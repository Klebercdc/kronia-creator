import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getReferenceLibraryEntry,
  listReferenceLibrary,
  listReferenceLibraryCategories,
  listReferenceLibraryMarkets,
  type ReferenceLibraryCard,
  type ReferenceLibraryEntry,
  type ReferenceLibraryPage,
} from "../lib/reference-library";

/** RPCs da Biblioteca de referência real (ver lib/reference-library.ts) —
 * catálogo estático, sem custo de LLM, só leitura. */
export const listReferenceLibraryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        category: z.string().nullable().optional(),
        market: z.string().nullable().optional(),
        hook: z.string().nullable().optional(),
        offset: z.number().int().nonnegative().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ReferenceLibraryPage> =>
    listReferenceLibrary({
      filters: { category: data.category, market: data.market, hook: data.hook },
      offset: data.offset,
    }),
  );

export const getReferenceLibraryEntryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<ReferenceLibraryEntry | null> => getReferenceLibraryEntry(data.id));

export const listReferenceLibraryFiltersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ categories: string[]; markets: string[] }> => ({
    categories: listReferenceLibraryCategories(),
    markets: listReferenceLibraryMarkets(),
  }),
);

export type { ReferenceLibraryCard };
