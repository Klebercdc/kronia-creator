import { createFileRoute } from "@tanstack/react-router";
import { advanceNextPendingJob, JOB_KINDS } from "../../../core/jobs/dispatcher";

/**
 * Worker independente do navegador — chamado pelo pg_cron do Supabase
 * (extensão já instalada) via pg_net a cada minuto, não pelo Vercel Cron
 * (Hobby só roda 1x/dia, não serve de worker) nem por polling do cliente.
 * Processa UM step do job mais antigo pendente de CADA kind registrado
 * (`JOB_KINDS`, ver dispatcher.ts) por invocação — mesmo limite de
 * execução de qualquer outra function, então mesmo desenho dos steps já
 * usados pelo polling do navegador (nunca aumenta o timeout); um kind
 * novo (ex. `generate_content`) só precisa se registrar no dispatcher,
 * nunca editar este arquivo.
 *
 * Protegido por CRON_SECRET: só quem souber o segredo (configurado no
 * pg_cron via migration, nunca no navegador) consegue disparar.
 */
export const Route = createFileRoute("/api/jobs/worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const processed = await Promise.all(
          JOB_KINDS.map(async (kind) => {
            const job = await advanceNextPendingJob(kind);
            return { kind, processed: !!job, jobId: job?.id ?? null, status: job?.status ?? null };
          }),
        );
        return Response.json({ processed });
      },
    },
  },
});
