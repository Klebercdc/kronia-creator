import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  composeMovementPrompt,
  listMovementCategories,
  listMovementsByCategory,
  type MovementCategory,
  type MovementEntry,
} from "../lib/movement-library";

export const listMovementCategoriesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MovementCategory[]> => listMovementCategories(),
);

export const listMovementsByCategoryFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ categorySlug: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<MovementEntry[]> => listMovementsByCategory(data.categorySlug));

export const composeMovementPromptFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ ids: z.array(z.string().min(1)).min(1) }).parse(data))
  .handler(async ({ data }) => composeMovementPrompt(data.ids));

export type { MovementCategory, MovementEntry };
