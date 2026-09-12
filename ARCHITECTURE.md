# Arquitetura — KRONIA Criador Inteligente

Mapa funcional do núcleo (`src/core`), das camadas de suporte (`src/lib`) e da
app (`src/routes`, `src/server`). Cada seção cita `arquivo:linha` — quando o
código mudar, atualizar as citações junto.

## Orquestração central

**`src/core/pipeline.ts:25-54`** — `runPipeline()`, o maestro. Decide entre
dois caminhos conforme `referenceVideoUrl` existir ou não, roda o loop de
correção de compliance (até `MAX_AUTO_COMPLIANCE_ATTEMPTS`,
`src/types/compliance.ts`), e escala pra edição manual
(`ManualEditRequiredError`, linha 10-15) se não aprovar.

## Etapa 1 — Ingestão (só Caminho A, com vídeo de referência)

**`src/core/ingestion/ingest.ts:19-52`** — orquestra:
- `downloadVideo` (`download.ts`) — baixa o vídeo via yt-dlp
- `probeVideo`/`extractFrames`/`sampleFrames` (`frames.ts`) — extrai até
  `MAX_FRAMES_FOR_VISION = 16` frames (linha 11)
- `parseVtt` (`transcribe.ts`) — lê legenda embutida, se houver
- `transcribeWithWhisper` (`whisper.ts`) — fallback via Whisper na OpenAI
  se não houver legenda
- `analyzeFrames` (`analyze.ts`) — visão computacional na OpenAI (única peça
  paga da ingestão)
- limpa os arquivos temporários no `finally` (linha 49-51), mesmo se der erro

## Etapa 2 — Classificação (só Caminho A)

**`src/core/classification/classify.ts:17-28`** — classifica o vídeo de
referência numa taxonomia fechada (`src/types/taxonomy.ts`):
`CONTENT_FORMATS` (14 formatos, linha 6-22), `HOOK_TYPES` (12 tipos,
linha 31-45, baseado em análise de 34.635 clipes reais conforme comentário),
`PERSUASION_MECHANISMS` (linha 47-59). Nunca inventa categoria fora da lista
(linha 10-12).

## Etapa 3 — Recomendação de formato

**`src/core/recommendation/recommend.ts:22-46`** — recomenda formato +
alternativas. `confidence` é sempre qualitativo (alta/media/baixa), nunca
percentual — regra explícita no prompt (linha 13-14) porque não existe dado
estatístico real por trás ainda.

## Etapa 4 — Geração (cadeia fixa de 6 sub-agentes)

**`src/core/generation/generate.ts:30-48`** — ordem fixa:

1. **Roteirista** (`roteirista.ts:108-137`) — hook nos 2s (linha 13-36),
   show-don't-tell (linha 38-45), estrutura de arco emocional
   (linha 47-55), retenção até o fim, duração em blocos de 10s
   (linha 82-88), ritmo de fala 2,5-3 palavras/s variável por emoção
   (linha 90-101)
2. **Marketing** (`marketing.ts:9-52`) — posicionamento estratégico,
   demonstração prática obrigatória quando objetivo=vender, CTA de fricção
   zero por modo (TikTok Shop = carrinho amarelo; orgânico =
   engajamento/pergunta genuína)
3. **Teólogo** (`teologo.ts:4-49`) — só roda se `project === "jeova_fala"`
   (`generate.ts:39-41`). Cita passagem bíblica real verbatim
   (linha 12-13), nunca inventa doutrina, CTA "digite amém" como convenção
   legítima, produto físico cristão ancorado em significado espiritual real
4. **Psicologia de Compra** (`psicologia-compra.ts:5-31`) — gatilhos de
   Cialdini/Kahneman (`taxonomy.ts:70-82`), só com evidência real por trás
   (linha 8-12); roda na OpenAI de propósito (linha 20-21, comentário:
   julgamento fino não é checagem mecânica)
5. **Persuasão** (`persuasao.ts:5-29`) — reforça mecanismos legítimos,
   proíbe explicitamente inventar números/fontes (linha 12-15)
6. **Cinematográfico** (`cinematografico.ts:5-100`) — gera `videoPrompt` por
   cena E agrupa em `flowSegments` de exatos 10s (restrição real do Google
   Flow, linha 11-19); fórmulas visuais de hero-shot (linha 39-50); trava
   voz/aparência do ator entre segmentos (linha 71-77)

**SEO sob demanda** (`seo.ts`, chamado via `generateSeoPackage` em
`pipeline.functions.ts:85-96`) — roda fora da cadeia principal, só quando o
usuário clica "Gerar legenda". Sem hashtag, de propósito.

## Etapa 5 — Compliance (gate)

**`src/core/compliance/validate.ts:38-75`** — combina 3 fontes:
- **`numeric-guard.ts:26-56`** — determinístico (sem IA): todo número na
  narração precisa existir literalmente numa claim `kind:"fato"`, senão é
  sinalizado como inventado (linha 11-24 explica a lógica e a limitação
  conhecida)
- **`absolute-claims-guard.ts:11-29,40-66`** — lista fixa de 17 frases
  banidas ("garantido", "100% eficaz", "milagroso" etc.), checagem por
  regex normalizado, sem IA
- **`copyright-check.ts:6-45`** — agente dedicado de IP na OpenAI, roda em
  paralelo (`validate.ts:49-57`, `Promise.all`)
- **check geral via IA** (OpenAI) — demais grupos de regra (`RULE_GROUPS`,
  `types/compliance.ts`)

**`correct.ts`** — reescreve o roteiro quando reprovado, até o teto de
tentativas.

## Camadas de suporte

- **`lib/openai.ts`** — `callStructuredText`/`callStructuredVisionFromDataUrls`
  — provider único do pipeline: chama OpenAI, valida contra o schema Zod,
  retry automático em erro de schema. Groq foi removido (ver
  `RELATORIO-AUDITORIA.md` ou o commit da migração): a cota diária gratuita
  se esgotava em uso normal de teste, e o fallback pra OpenAI que existia
  pra cobrir isso tinha um bug próprio de serialização de schema (`$ref`
  fora do topo, rejeitado pelo modo strict) — dois providers pra manter,
  metade da confiabilidade. `toJsonSchema()` usa `$refStrategy: "none"`
  pra nunca gerar `$ref` (schemas com enum/objeto reaproveitado em mais de
  um campo, como `ComplianceResultSchema`, inlinam em vez de referenciar).
- **`lib/cost-tracker.ts`** — loga cada chamada em `logs/usage.jsonl`
  (provider único: OpenAI, preço estimado em `gpt-4o-mini` por milhão de
  tokens).
  **Limitação conhecida, ainda não corrigida**:
  - roda em disco local — no Vercel (serverless, filesystem efêmero) isso
    não persiste entre invocações.
- **`lib/supabase.ts`** — `creator_saved_themes` e `creator_history`,
  isoladas por RLS no projeto Supabase compartilhado com o app de treino
  (`Klebercdc's Project`).

## Camada de app (React / TanStack Start)

- **`server/pipeline.functions.ts`** — todas as RPCs: `runContentPipeline`,
  `analyzeActorPhoto`, `analyzeProductPhoto` (agente de visão do produto,
  `core/generation/product-vision.ts`), `refineScene`,
  `generateSeoPackage`, temas salvos e histórico (6 RPCs no total).
- **`routes/index.tsx`** — UI completa: fluxo Criar → Analisar → Resultado
  → Roteiro, nav inferior real (Criar/Histórico/Explorar/Perfil — Explorar
  e Perfil ainda são placeholder "em breve"), Histórico persistido no
  Supabase.
- Paleta e ícones seguem o handoff de design (`KroniaMockup.dc.html`) —
  hex exatos, sem lucide/emoji, ícones em SVG traço próprio.

## Pendências / dívida técnica conhecida

- ~~Ingestão (Caminho A) desligada~~ — **[Corrigido]** ver seção
  "Auditoria (histórico)" abaixo. `yt-dlp`/`ffmpeg`/`ffprobe` agora são
  baixados sob demanda pra `/tmp` na primeira execução de cada instância
  fria (`src/lib/vendored-binary.ts`), em vez de depender do PATH do
  runtime ou de empacotar os binários no build. Campo "Vídeo de
  referência" reabilitado na UI.
- Cost-tracker não sobrevive a deploy serverless (ver acima).
- ~~Nenhum aviso na UI quando uma geração usa o fallback pago (Groq
  estourou)~~ — **[Resolvido pela remoção do Groq]** provider único agora,
  não existe mais fallback pra avisar.
- Explorar e Perfil são placeholders sem funcionalidade real.
- Reaproveitar um item do Histórico pra gerar variações do mesmo tema
  ainda não foi construído (ideia levantada, não implementada).

## Auditoria (histórico)

- **[Corrigido, commit `807c0df`]** `src/lib/openai.ts` convertia os schemas
  Zod pra JSON Schema com `target: "openApi3"`, que gera
  `"exclusiveMinimum": true` (booleano, estilo draft-04) em campos
  `.positive()` como `FlowSegmentSchema.endSeconds` e
  `VideoAnalysisSchema.durationSeconds`. A OpenAI em modo strict rejeita isso
  com `400 Invalid schema: True is not of type 'number'`. Como
  **Psicologia de Compra roda em toda geração, sem checar `project`**
  (`generate.ts`), isso provavelmente derrubava toda chamada real (não
  mockada) ao pipeline — mascarado pelo smoke-test offline, que usa um
  servidor mock que não faz a validação de schema que a OpenAI real faz.
  Mesma causa raiz do bug que os commits do usuário já haviam corrigido em
  `src/lib/llm.ts` (o caminho de fallback), só que num arquivo diferente.
  Trocado pra `target: "jsonSchema7"`, confirmado sem `exclusiveMinimum`
  booleano restante em `GenerationResultSchema`, `ContentRequestSchema`,
  `VideoAnalysisSchema` e `ComplianceResultSchema`.

- **[Corrigido, ver RELATORIO-AUDITORIA.md pro histórico completo das 3
  tentativas falhas]** Ingestão dependia de `yt-dlp`/`ffmpeg`/`ffprobe` no
  PATH do sistema, inexistentes no runtime do Vercel. Três formas de
  vendorizar falharam (rate limit de API no install, binário não incluído
  no bundle, build estourando memória tentando embutir ~200MB via base64).
  A que funcionou: `src/lib/vendored-binary.ts` baixa cada binário sob
  demanda direto pra `/tmp` na primeira chamada de cada instância fria
  (yt-dlp: download direto do release do GitHub, ~40MB; ffmpeg+ffprobe: um
  único tarball estático do johnvansickle.com, ~42MB comprimido, os dois
  binários saem da mesma extração). Nada disso entra no bundle de deploy —
  `.output` voltou a 4.5MB (era >250MB tentando embutir). Testado de ponta
  a ponta: download+execução dos 3 binários (yt-dlp 1.9s, ffmpeg+ffprobe
  5.7s na primeira vez, instantâneo depois — cache em memória por
  instância), e o pipeline de processamento de vídeo completo
  (`probeVideo`, `extractFrames`, `transcribeWithWhisper` — essa última
  com uma chamada real à Groq) rodando sobre um vídeo sintético gerado
  localmente. Não testado: o download real de uma URL do TikTok/YouTube
  via yt-dlp em produção (só o binário rodando, `--version`) — o mecanismo
  de download em si é o uso normal e documentado do yt-dlp, risco residual
  baixo comparado ao que já foi validado.
