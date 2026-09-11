import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase pro NAVEGADOR — só pra upload direto do vídeo de
 * referência no bucket `creator-reference-videos` (evita mandar o arquivo
 * no corpo de uma Serverless Function, que no Vercel tem teto de ~4.5MB).
 * A chave é anon/publishable (mesmo nível de acesso de sempre já é público
 * no bundle do cliente) e a policy de RLS do bucket restringe o que ela
 * pode fazer — não dá acesso a nada fora desse bucket.
 */
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    const url = import.meta.env.KRONIA_PUBLIC_SUPABASE_URL;
    const key = import.meta.env.KRONIA_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("KRONIA_PUBLIC_SUPABASE_URL/KRONIA_PUBLIC_SUPABASE_ANON_KEY não configurados no .env");
    }
    client = createClient(url, key);
  }
  return client;
}

export const REFERENCE_VIDEO_BUCKET = "creator-reference-videos";

/** Envia o vídeo direto do navegador pro Storage e devolve o path — o
 * servidor baixa a partir daí na Ingestão (ver core/ingestion/storage-download.ts). */
export async function uploadReferenceVideo(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "mp4";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabaseBrowserClient().storage.from(REFERENCE_VIDEO_BUCKET).upload(path, file, {
    contentType: file.type || "video/mp4",
  });
  if (error) throw error;
  return path;
}
