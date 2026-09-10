# KRONIA — Criador Inteligente

Núcleo de inteligência de conteúdo do KRONIA: analisa vídeos de referência, classifica formato e mecânica de persuasão, recomenda o melhor formato para um produto/objetivo, gera roteiro e valida compliance antes da entrega.

Pipeline: **Ingestão → Classificação → Recomendação → Geração → Compliance**

Cadeia de agentes da Geração (fixa, nessa ordem):
**Roteirista → Marketing → Teólogo (só Jeová Fala) → Psicologia de Compra → Persuasão → Cinematográfico → SEO**,
seguida do gate de Compliance (que inclui checagem dedicada de Copyright).

Atende dois verticais sobre o mesmo núcleo — a única diferença é o Teólogo:
- **Comercial** (TikTok / TikTok Shop)
- **Jeová Fala** (conteúdo teológico)

Este repositório substitui o conteúdo anterior (protótipo de app de treino/fitness) — a partir deste commit começa do zero com o escopo de Content Intelligence.

## Estrutura

```
src/
  types/                 — schemas Zod (fonte de verdade) + tipos TS inferidos
    taxonomy.ts          — formatos, hooks, persuasão, objetivo, modo, projeto (fechado e editável)
    evidence.ts          — fato / inferência / sugestão da IA / desconhecido
    video-analysis.ts    — saída estruturada da Ingestão
    compliance.ts        — grupos de regra versionados + resultado do gate
    pipeline.ts          — ContentRequest → ClassificationResult → FormatRecommendation → GenerationResult → PipelineOutput
  lib/
    llm.ts                 — client Groq (texto), saída estruturada validada por Zod, retry em falha de schema
    openai.ts               — client OpenAI (texto + visão) — peça paga, reservada pro que exige julgamento fino
  core/
    ingestion/               — download (yt-dlp) → frames (ffmpeg) → transcript (legendas/Whisper via Groq) → visão (OpenAI)
      download.ts · frames.ts · transcribe.ts · whisper.ts · analyze.ts · ingest.ts (orquestrador)
    classification/classify.ts
    recommendation/recommend.ts
    generation/               — Groq: roteirista, marketing, persuasão, cinematográfico, seo. OpenAI: teólogo, psicologia de compra
      roteirista.ts · marketing.ts · teologo.ts · psicologia-compra.ts · persuasao.ts · cinematografico.ts · generate.ts (orquestrador)
    compliance/
      validate.ts (gate, Groq) · copyright-check.ts (OpenAI) · correct.ts (correção direcionada às violações)
    pipeline.ts            — orquestra os Caminhos A/B ponta a ponta, com teto de correção automática
  server/
    pipeline.functions.ts   — server function (RPC) que expõe o núcleo ao app
  routes/
    __root.tsx · index.tsx  — as 3 telas (Criar / Resultado / Roteiro) em React
```

## Rodando

```
cp .env.example .env   # preencher GROQ_API_KEY e OPENAI_API_KEY
npm install
npm run typecheck
npm run dev                     # app completo em http://localhost:3000
npm run smoke-test              # Caminho B via terminal (sem UI)
npm run smoke-test:ingest -- <url-do-video>   # só a Ingestão
```

Precisa de `yt-dlp` e `ffmpeg`/`ffprobe` no PATH para a Ingestão.

## Status

Núcleo completo implementado e app conectado de ponta a ponta, testado com
chamadas reais: Ingestão (yt-dlp + ffmpeg + Whisper/Groq + visão/OpenAI) →
Classificação → Recomendação → Geração (6 sub-agentes) → Compliance (gate +
checagem de copyright, com correção automática e teto de 2 tentativas antes
de escalar para edição manual) → as 3 telas em React chamando tudo isso via
server function.

A maior parte do pipeline roda na Groq (grátis). A OpenAI (paga) fica
reservada pro que exige julgamento mais fino: leitura visual dos frames na
Ingestão, Teólogo (doutrina errada tem custo reputacional alto), Psicologia
de Compra (a linha entre gatilho legítimo e manipulação exige nuance) e
Copyright (avaliar risco de propriedade intelectual não é checagem
mecânica). `npm run typecheck` passa limpo e o fluxo completo (formulário →
resultado → roteiro) foi validado num navegador de verdade.

O app não gera o vídeo final — entrega roteiro + prompt de vídeo pronto pra
colar no Flow (ou outro gerador externo), que é o fluxo real do usuário.

**Falta**: upload de foto de produto (a tela já tem o campo, o backend
ainda não recebe imagem — só texto) e persistência (nada é salvo — cada
sessão começa do zero, sem Histórico funcional).

**Risco conhecido**: YouTube bloqueia downloads via yt-dlp de IPs de
datacenter com 429 (rate limit) — funcionou normalmente com vídeo hospedado
fora do YouTube. Vale monitorar em produção; é o mesmo risco já sinalizado
na auditoria do Video Analyzer original.
