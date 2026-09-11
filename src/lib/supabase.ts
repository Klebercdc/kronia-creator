import { createClient } from "@supabase/supabase-js";
import type { PipelineOutput } from "../types/pipeline";

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
