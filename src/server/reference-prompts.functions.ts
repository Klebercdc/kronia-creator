import "../lib/error-serialization";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  listReferencePromptCategories,
  listReferencePromptsByCategory,
  getReferencePrompt,
  type ReferencePromptCategory,
  type ReferencePromptCard,
  type ReferencePromptPage,
  type ReferencePromptEntry,
} from "../lib/reference-prompts";

export const listReferencePromptCategoriesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReferencePromptCategory[]> => listReferencePromptCategories(),
);

export const listReferencePromptsByCategoryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ categorySlug: z.string().min(1), offset: z.number().int().nonnegative().optional() }).parse(data),
  )
  .handler(async ({ data }): Promise<ReferencePromptPage> => listReferencePromptsByCategory(data.categorySlug, data.offset));

export const getReferencePromptFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<ReferencePromptEntry | null> => getReferencePrompt(data.id));

export type { ReferencePromptCategory, ReferencePromptCard, ReferencePromptEntry };
