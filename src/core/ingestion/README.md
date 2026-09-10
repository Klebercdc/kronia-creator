# Ingestão

Baseado no Video Analyzer (pipeline `download → frames → transcript`), adaptado
para devolver `VideoAnalysis` (src/types/video-analysis.ts) — dados estruturados,
não só transcript e imagens soltas.

Só roda no Caminho A (quando `referenceVideoUrl` está presente).

Referência: yt-dlp (download) + ffmpeg (frames com fps auto-escalado por
orçamento) + Whisper/legendas nativas (transcript) + leitura de frames por
visão multimodal para preencher `hook`, `format`, `structure`, `visual`,
`persuasion`.
