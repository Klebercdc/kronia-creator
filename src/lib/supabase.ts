import { createClient } from "@supabase/supabase-js";
import type { PipelineOutput } from "../types/pipeline";

export type JobStatus = "pending" | "running" | "succeeded" | "failed";

/** Schema mínimo só das tabelas que este app usa — o projeto Supabase é
 * compartilhado com outro produto (app de treino), mas o KRONIA Criador
 * Inteligente só enxerga/tipa essas tabelas, isoladas das demais. */
interface Database {
  public: {
    Tables: {
      creator_saved_themes: {
        Row: { id: string; text: string; created_at: string };
        Insert: { text: string };
        Update: { text?: string };
        Relationships: [];
      };
      creator_conversations: {
        Row: { id: string; title: string; created_at: string; updated_at: string };
        Insert: { title?: string };
        Update: { title?: string; updated_at?: string };
        Relationships: [];
      };
      creator_conversation_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          attachments: Record<string, unknown>[];
          job_id: string | null;
          created_at: string;
        };
        Insert: {
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          attachments?: Record<string, unknown>[];
          job_id?: string | null;
        };
        Update: never;
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
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          kind: string;
          step: string;
          payload: Record<string, unknown>;
          idempotency_key?: string | null;
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
    Functions: {
      claim_next_job: {
        Args: { job_kind: string; lease_seconds?: number };
        Returns: {
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
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
    };
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

/** Conversas — memória real da Home/"Conversas" (ver types/conversation.ts
 * pro shape validado por Zod usado pelo resto do app; aqui é só CRUD
 * cru sobre as tabelas). */
export interface ConversationRow {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageRow {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  attachments: Record<string, unknown>[];
  jobId: string | null;
  createdAt: string;
}

export async function createConversation(title = ""): Promise<ConversationRow> {
  const { data, error } = await getSupabase().from("creator_conversations").insert([{ title }]).select("*").single();
  if (error) throw error;
  return { id: data.id, title: data.title, createdAt: data.created_at, updatedAt: data.updated_at };
}

export async function listConversations(limit = 30): Promise<ConversationRow[]> {
  const { data, error } = await getSupabase()
    .from("creator_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at, updatedAt: d.updated_at }));
}

export async function getConversation(id: string): Promise<ConversationRow | null> {
  const { data, error } = await getSupabase().from("creator_conversations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, title: data.title, createdAt: data.created_at, updatedAt: data.updated_at } : null;
}

export async function touchConversationTitle(id: string, title: string): Promise<void> {
  const { error } = await getSupabase()
    .from("creator_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function touchConversation(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("creator_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function listConversationMessages(conversationId: string): Promise<ConversationMessageRow[]> {
  const { data, error } = await getSupabase()
    .from("creator_conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    conversationId: d.conversation_id,
    role: d.role,
    content: d.content,
    attachments: d.attachments,
    jobId: d.job_id,
    createdAt: d.created_at,
  }));
}

export async function addConversationMessage(entry: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Record<string, unknown>[];
  jobId?: string | null;
}): Promise<ConversationMessageRow> {
  const { data, error } = await getSupabase()
    .from("creator_conversation_messages")
    .insert([
      {
        conversation_id: entry.conversationId,
        role: entry.role,
        content: entry.content,
        attachments: entry.attachments ?? [],
        job_id: entry.jobId ?? null,
      },
    ])
    .select("*")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    conversationId: data.conversation_id,
    role: data.role,
    content: data.content,
    attachments: data.attachments,
    jobId: data.job_id,
    createdAt: data.created_at,
  };
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
 * Etapa 0 — Job Engine. Fila persistida em Postgres (Supabase). Dois jeitos
 * de avançar um job (ambos convergem no mesmo `claim` atômico, então nunca
 * processam o mesmo step em duplicidade):
 * 1) O polling do próprio navegador (rápido, mas só avança enquanto a aba
 *    está aberta).
 * 2) Um worker de verdade, independente do navegador: pg_cron (extensão já
 *    instalada no Supabase) chama `/api/jobs/worker` a cada minuto via
 *    pg_net — continua avançando o job mesmo com a aba fechada. Não usamos
 *    Vercel Cron porque no plano Hobby ele só roda 1x/dia (não serve de
 *    worker), nem Vercel Queues (produto ainda beta).
 */
export async function createJob(
  kind: string,
  step: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<JobRow> {
  const { data, error } = await getSupabase()
    .from("creator_jobs")
    .insert([{ kind, step, payload, idempotency_key: idempotencyKey ?? null }])
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation — já existe um job pra essa idempotency_key
    // (ex: o mesmo vídeo enviado duas vezes). Devolve o job existente em
    // vez de criar um duplicado.
    if (error.code === "23505" && idempotencyKey) {
      const { data: existing, error: fetchError } = await getSupabase()
        .from("creator_jobs")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .single();
      if (fetchError) throw fetchError;
      return existing as JobRow;
    }
    throw error;
  }
  return data as JobRow;
}

export async function getJob(id: string): Promise<JobRow | null> {
  const { data, error } = await getSupabase().from("creator_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as JobRow | null;
}

/** Janela de lease — um step preso em "running" além disso é considerado
 * abandonado (worker morreu/crashou no meio) e pode ser reivindicado de
 * novo. Maior que o teto real de execução do Vercel (60s) com folga, pra
 * nunca reivindicar um step que ainda está genuinamente rodando. */
const JOB_LEASE_SECONDS = 75;

/** Reivindica o job pra processar um step — compare-and-swap: só passa de
 * "pending" (ou "running" com lease expirado, ou seja, abandonado) pra
 * "running" se ESTE chamador ganhar a corrida. Devolve null se outro
 * chamador (poll do navegador ou o worker) já estava processando. */
export async function claimJob(id: string): Promise<JobRow | null> {
  const leaseCutoff = new Date(Date.now() - JOB_LEASE_SECONDS * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from("creator_jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", id)
    .or(`status.eq.pending,and(status.eq.running,updated_at.lt.${leaseCutoff})`)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as JobRow | null;
}

/** Mesma reivindicação, mas sem saber o id de antemão — pega o job mais
 * antigo elegível de um "kind" (pending, ou running com lease expirado).
 * Usado pelo worker (pg_cron), que só sabe "existe trabalho pendente
 * desse tipo", não qual job específico. Atômico via função Postgres
 * (FOR UPDATE SKIP LOCKED) — ver migration creator_jobs_claim_next_function. */
export async function claimNextJob(kind: string): Promise<JobRow | null> {
  const { data, error } = await getSupabase().rpc("claim_next_job", {
    job_kind: kind,
    lease_seconds: JOB_LEASE_SECONDS,
  });
  if (error) throw error;
  const rows = data as JobRow[] | null;
  return rows?.[0] ?? null;
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
 * poll) até estourar `max_attempts`, aí marca "failed" definitivo. Devolve
 * o status final pro chamador decidir se precisa limpar artefatos órfãos
 * (só faz sentido quando "failed" — enquanto ainda pode tentar de novo, os
 * artefatos continuam sendo usados). */
export async function failJobStep(job: JobRow, message: string): Promise<JobStatus> {
  const attempts = job.attempts + 1;
  const status: JobStatus = attempts >= job.max_attempts ? "failed" : "pending";
  const { error } = await getSupabase()
    .from("creator_jobs")
    .update({ status, attempts, error: message, updated_at: new Date().toISOString() })
    .eq("id", job.id);
  if (error) throw error;
  return status;
}
