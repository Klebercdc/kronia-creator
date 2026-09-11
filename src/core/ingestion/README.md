# Ingestão

Baseado no Video Analyzer (pipeline `download → frames → transcript`), adaptado
para devolver `VideoAnalysis` (src/types/video-analysis.ts) — dados estruturados,
não só transcript e imagens soltas.

Só roda no Caminho A (quando `referenceVideoUrl` ou `referenceVideoStoragePath`
está presente — `ingest()` recebe um `ReferenceVideoSource`, ver `ingest.ts`).

Duas formas de chegar no vídeo:
- **Link** (`download.ts`): yt-dlp baixa da URL. Pode falhar se a plataforma
  bloquear/mudar anti-bot — nunca 100% garantido em produção.
- **Upload** (`storage-download.ts`): fallback quando o link não funciona —
  o usuário envia um arquivo direto (ex: gravação de tela) pro navegador, que
  sobe pro bucket privado `creator-reference-videos` no Supabase Storage
  (`src/lib/supabase-client.ts`, upload direto do browser — nunca passa pelo
  corpo da Serverless Function, que tem teto de ~4.5MB no Vercel). O servidor
  baixa de lá, processa, e apaga o objeto no `finally` de `ingest()` — mesma
  política de "não guarda vídeo" do caminho por link.

Depois do download (por qualquer uma das duas formas): ffmpeg (frames com fps
auto-escalado por orçamento) + Whisper/legendas nativas (transcript, só
disponível no caminho por link) + leitura de frames por visão multimodal para
preencher `hook`, `format`, `structure`, `visual`, `persuasion`.
