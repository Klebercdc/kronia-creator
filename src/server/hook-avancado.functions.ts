import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateHookPrompt, HOOK_TYPES, type HookType } from "../core/generation/hook-avancado";
import { getMovementsByIds } from "../lib/movement-library";

export const listHookTypesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ value: HookType; label: string }[]> =>
    (Object.keys(HOOK_TYPES) as HookType[]).map((value) => ({ value, label: HOOK_TYPES[value] })),
);

export const generateHookPromptFn = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        movementIds: z.array(z.string().min(1)).min(1),
        hookType: z.enum(Object.keys(HOOK_TYPES) as [HookType, ...HookType[]]),
        subjectType: z.enum(["person", "product"]),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ prompt: string }> => {
    // Busca os movimentos pelo id no servidor — nunca confia em texto de
    // ação vindo direto do cliente, só nos ids da seleção (mesmo princípio
    // do composeMovementPromptFn).
    const byId = new Map(getMovementsByIds(data.movementIds).map((e) => [e.id, e]));
    const ordered = data.movementIds.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
    const totalDurationSec = ordered.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);

    const prompt = await generateHookPrompt({
      movementActions: ordered.map((e) => e.body),
      hookType: data.hookType,
      subjectType: data.subjectType,
      totalDurationSec,
    });
    return { prompt };
  });

export type { HookType };
