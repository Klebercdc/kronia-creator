import { createFileRoute } from "@tanstack/react-router";
import { advanceNextPendingJob } from "../../../core/jobs/dispatcher";

/**
 * Worker independente do navegador — chamado pelo pg_cron do Supabase
 * (extensão já instalada) via pg_net a cada minuto, não pelo Vercel Cron
 * (Hobby só roda 1x/dia, não serve de worker) nem por polling do cliente.
 * Processa UM step do job mais antigo pendente por invocação — mesmo
 * limite de execução de qualquer outra function, então mesmo desenho dos
 * steps já usados pelo polling do navegador (nunca aumenta o timeout).
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

        const job = await advanceNextPendingJob("ingest_reference_video");
        return Response.json({ processed: !!job, jobId: job?.id ?? null, status: job?.status ?? null });
      },
    },
  },
});
