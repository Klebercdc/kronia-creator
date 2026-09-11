import { createClient } from "@supabase/supabase-js";
import type { PipelineOutput } from "../types/pipeline";

export type JobStatus = "pending" | "running" | "succeeded" | "failed";

/** Schema mínimo só da tabela que este app usa — o projeto Supabase é
 * compartilhado com outro produto (app de treino), mas o KRONIA Criador
 * Inteligente só enxerga/tipa essa uma tabela, isolada das demais. */
interface Database {
  public: {
    Tables: {
      creator_saved_themes: {
        Row: { id: string; text: string; created_at: string };
        Insert: { text: string };
        Update: { text?: string };
        Relationships: [];
      };
      creator_history: {
        Row: {
          id: string;
          created_at: string;
          project: string;
          format: string;
          theme: string;
          selected_hook: string;
          output: PipelineOutput;
        };
        Insert: {
          project: string;
          format: string;
          theme: string;
          selected_hook: string;
          output: PipelineOutput;
        };
        Update: never;
        Relationships: [];
      };
      creator_jobs: {
        Row: {
          id: string;
          kind: string;
          status: JobStatus;
          step: string;
          payload: Record<string, unknown>;
          progress: Record<string, unknown>;
          result: Record<string, unknown> | null;
          error: string | null;
          attempts: number;
          max_attempts: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          kind: string;
          step: string;
          payload: Record<string, unknown>;
        };
        Update: {
          status?: JobStatus;
          step?: string;
          progress?: Record<string, unknown>;
          result?: Record<string, unknown> | null;
          error?: string | null;
          attempts?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let client: ReturnType<typeof createClient<Database>> | null = null;

/** Cliente Supabase, só pro servidor — a chave nunca vai pro navegador. */
export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY não configurados no .env");
    }
    client = createClient<Database>(url, key);
  }
  return client;
}

export type JobRow = Database["public"]["Tables"]["creator_jobs"]["Row"];

export interface SavedTheme {
  id: string;
  text: string;
}

export async function listSavedThemes(): Promise<SavedTheme[]> {
  const { data, error } = await getSupabase()
    .from("creator_saved_themes")
    .select("id, text")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data as SavedTheme[];
}

export async function addSavedTheme(text: string): Promise<SavedTheme> {
  const { data, error } = await getSupabase()
    .from("creator_saved_themes")
    .insert([{ text }])
    .select("id, text")
    .single();
  if (error) throw error;
  return data as SavedTheme;
}

export async function removeSavedTheme(id: string): Promise<void> {
  const { error } = await getSupabase().from("creator_saved_themes").delete().eq("id", id);
  if (error) throw error;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  project: string;
  format: string;
  theme: string;
  selectedHook: string;
  output: PipelineOutput;
}

export async function addHistoryEntry(entry: {
  project: string;
  format: string;
  theme: string;
  selectedHook: string;
  output: PipelineOutput;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("creator_history")
    .insert([
      {
        project: entry.project,
        format: entry.format,
        theme: entry.theme,
        selected_hook: entry.selectedHook,
        output: entry.output,
      },
    ]);
  if (error) throw error;
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await getSupabase()
    .from("creator_history")
    .select("id, created_at, project, format, theme, selected_hook, output")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    project: row.project,
    format: row.format,
    theme: row.theme,
    selectedHook: row.selected_hook,
    output: row.output,
  }));
}

export async function removeHistoryEntry(id: string): Promise<void> {
  const { error } = await getSupabase().from("creator_history").delete().eq("id", id);
  if (error) throw error;
}

/** Nome do bucket usado pra upload direto do navegador de vídeo de
 * referência (fallback quando o link do TikTok/yt-dlp não funciona — ex:
 * o usuário grava a própria tela). Bucket privado; ver
 * supabase/migrations (RLS: anon só insert/select/delete, escopado a este
 * bucket, nunca lista/lê outro). */
export const REFERENCE_VIDEO_BUCKET = "creator-reference-videos";

/** Baixa o arquivo enviado pelo navegador — o servidor processa e descarta,
 * nunca guarda o vídeo (mesma política do Caminho A via yt-dlp). */
export async function downloadReferenceVideoUpload(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await getSupabase().storage.from(REFERENCE_VIDEO_BUCKET).download(storagePath);
  if (error) throw error;
  return data.arrayBuffer();
}

export async function deleteReferenceVideoUpload(storagePath: string): Promise<void> {
  await getSupabase().storage.from(REFERENCE_VIDEO_BUCKET).remove([storagePath]);
}

/** Sobe/baixa/apaga artefato intermediário de um job (frame extraído,
 * áudio) — mesmo bucket do upload, sob o prefixo `jobs/{jobId}/`, pra não
 * precisar de bucket novo. Vive só durante o processamento do job. */
export async function uploadJobArtifact(path: string, data: Buffer, contentType: string): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(REFERENCE_VIDEO_BUCKET)
    .upload(path, data, { contentType, upsert: true });
  if (error) throw error;
}

export async function downloadJobArtifact(path: string): Promise<ArrayBuffer> {
  const { data, error } = await getSupabase().storage.from(REFERENCE_VIDEO_BUCKET).download(path);
  if (error) throw error;
  return data.arrayBuffer();
}

export async function deleteJobArtifact(path: string): Promise<void> {
  await getSupabase().storage.from(REFERENCE_VIDEO_BUCKET).remove([path]);
}

/** Apaga tudo sob um prefixo (ex: `jobs/{jobId}/`) — lista e remove em lote. */
export async function removeJobArtifacts(prefix: string): Promise<void> {
  // `list()` não é recursivo — devolve "frames" como uma entrada de pasta,
  // não os arquivos dentro dela. Lista o subdiretório de frames direto.
  const client = getSupabase().storage.from(REFERENCE_VIDEO_BUCKET);
  const { data, error } = await client.list(`${prefix}/frames`);
  if (error || !data?.length) return;
  await client.remove(data.map((f) => `${prefix}/frames/${f.name}`));
}

/**
 * Etapa 0 — Job Engine. Fila persistida em Postgres (Supabase), processada
 * por invocações curtas disparadas pelo próprio polling do cliente — sem
 * depender de Vercel Cron (no Hobby, cron roda no máximo 1x/dia, não serve
 * de worker) nem de Vercel Queues (produto ainda beta). Cada "step" é uma
 * unidade de trabalho que cabe sozinha nos 60s da function; o job avança de
 * step em step a cada poll até `succeeded`/`failed`.
 */
export async function createJob(kind: string, step: string, payload: Record<string, unknown>): Promise<JobRow> {
  const { data, error } = await getSupabase()
    .from("creator_jobs")
    .insert([{ kind, step, payload }])
    .select("*")
    .single();
  if (error) throw error;
  return data as JobRow;
}

export async function getJob(id: string): Promise<JobRow | null> {
  const { data, error } = await getSupabase().from("creator_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as JobRow | null;
}

/** Reivindica o job pra processar um step — compare-and-swap via
 * `status='pending'` na cláusula WHERE: só um poll concorrente consegue
 * passar de "pending" pra "running" por vez (idempotência). Devolve null
 * se outro poll já estava processando (o chamador só espera o próximo). */
export async function claimJob(id: string): Promise<JobRow | null> {
  const { data, error } = await getSupabase()
    .from("creator_jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as JobRow | null;
}

/** Avança o job pro próximo step (continua "running" até o cliente pollar
 * de novo — devolve pra "pending" pra liberar o próximo claim). */
export async function advanceJobStep(
  id: string,
  step: string,
  progressPatch: Record<string, unknown>,
): Promise<void> {
  const { error } = await getSupabase()
    .from("creator_jobs")
    .update({ status: "pending", step, progress: progressPatch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function completeJob(id: string, result: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabase()
    .from("creator_jobs")
    .update({ status: "succeeded", result, error: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Falha do step atual — volta pra "pending" (tenta de novo no próximo
 * poll) até estourar `max_attempts`, aí marca "failed" definitivo. */
export async function failJobStep(job: JobRow, message: string): Promise<void> {
  const attempts = job.attempts + 1;
  const status: JobStatus = attempts >= job.max_attempts ? "failed" : "pending";
  const { error } = await getSupabase()
    .from("creator_jobs")
    .update({ status, attempts, error: message, updated_at: new Date().toISOString() })
    .eq("id", job.id);
  if (error) throw error;
}
