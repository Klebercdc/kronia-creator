# Relatório de auditoria — KRONIA Criador Inteligente

Data: sessão de auditoria do núcleo (`src/core`, `src/lib`) + tentativa de
correção da Ingestão. Cobre o que foi encontrado, o que foi corrigido, e o
que continua quebrado com o motivo exato.

---

## 1. CRÍTICO — corrigido e no ar (commit `807c0df`)

**O quê**: `src/lib/openai.ts` convertia os schemas Zod pra JSON Schema com
`target: "openApi3"` (zod-to-json-schema), que gera
`"exclusiveMinimum": true` (booleano, estilo JSON Schema draft-04) em campos
`.positive()` como `FlowSegmentSchema.endSeconds` e
`VideoAnalysisSchema.durationSeconds`.

**Efeito real**: a OpenAI, em modo strict, rejeita esse schema com
`400 Invalid schema for response_format: True is not of type 'number'`.

**Alcance**: como o agente **Psicologia de Compra roda em toda geração,
sempre**, sem checar `project` (`src/core/generation/generate.ts`), isso
provavelmente quebrava **toda chamada real** ao pipeline (não as chamadas
mockadas do smoke-test, que usam um servidor local que não valida schema
como a OpenAI faz). Também afetava o agente Teólogo e a análise visual da
Ingestão.

**Por que passou despercebido**: é exatamente o mesmo tipo de bug que você
já tinha corrigido antes em `src/lib/llm.ts` (o caminho de fallback pra
OpenAI quando a Groq estoura cota) — só que `lib/openai.ts` é um arquivo
irmão, usado pelos agentes que rodam direto na OpenAI, e nunca foi tocado
pelos seus 3 commits de correção.

**Correção**: trocado pra `target: "jsonSchema7"` (gera o valor numérico
correto). Testado contra os 4 schemas relevantes — nenhum
`exclusiveMinimum`/`exclusiveMaximum` booleano restante.

**Status**: ✅ corrigido, testado, no ar em produção.

---

## 2. ALTO RISCO — não corrigido, Ingestão desligada (commit `4dc9065`)

**O quê**: o Caminho A (gerar roteiro a partir de um vídeo de referência)
depende de 3 binários externos — `yt-dlp`, `ffmpeg`, `ffprobe` — chamados
via `execFile` em `src/core/ingestion/{download,frames,whisper}.ts`.
Nenhum dos três vem instalado no runtime serverless do Vercel.

**Tentei corrigir de verdade antes de desistir.** Três tentativas, três
falhas diferentes, todas reproduzidas ao vivo (não é suposição):

### Tentativa 1 — pacote npm `youtube-dl-exec`
Vendoriza yt-dlp automaticamente no `npm install`.
**Falha**: o install quebrou na hora, com rate limit da API do GitHub:
```
npm error Error: {
  "message": "API rate limit exceeded for 34.170.141.253...",
  "documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
}
```
O mesmo tipo de falha intermitente aconteceria num build do Vercel
(servidores de build compartilham IP entre muitos usuários, mais propensos
a rate limit ainda).

### Tentativa 2 — `ffmpeg-static` + `@ffprobe-installer/ffprobe` via `require` normal
Pacotes maduros, amplamente usados em produção Vercel/Lambda.
**Falha**: inspecionei o `.output/server` depois do build e o pacote só
empacota o **código JS que calcula o caminho** do binário
(`path.join(__dirname, 'ffmpeg')`), não o binário em si. Em produção
(onde só `.output` é implantado, não o `node_modules` completo) esse
caminho apontaria pra um arquivo que não existe.

### Tentativa 3 — vendorizar os 3 binários direto no repo (`vendor/`) via `serverAssets` do Nitro
A saída "correta": baixei os binários (testei que rodam), configurei
`vite.config.ts` pra empacotá-los como asset do servidor, criei um helper
que extrai pra `/tmp` na primeira execução (único diretório gravável em
runtime serverless).

Sozinho, o yt-dlp (40MB) empacotou certo — confirmado no build
(`.output/server/_virtual/yt-dlp.mjs`, 54MB, batendo com a inflação
esperada do base64).

**Falha**: somando os 3 (`yt-dlp` 40MB + `ffmpeg` 79MB + `ffprobe` 79MB ≈
200MB), o processo de build **estourou a memória e crashou**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
Aborted
```
Depois de 3m23s de build. Não é lentidão — é o processo Node do build
morrendo por falta de RAM tentando converter ~200MB de binário pra base64
de uma vez, dentro do bundler (Rollup/Nitro). Isso quebra o build **local**;
nem chegaria a ser testado no Vercel.

Revertido tudo dessa tentativa (código, `vendor/`, dependências) — não dava
pra empacotar os 3 binários no build.

### Tentativa 4 — baixar sob demanda em vez de empacotar no build
A saída que funcionou. Em vez de tentar colocar os binários *dentro* do
pacote de deploy (que é o que faz o build estourar memória), eles são
baixados **em runtime**, na primeira chamada de cada instância fria do
servidor, direto pra `/tmp` (único diretório gravável garantido em
qualquer ambiente serverless) — nunca entram no bundle.

- `yt-dlp`: download direto do link de release do GitHub (não da API —
  esse é o link que tinha dado rate limit; o link de release direto nunca
  deu problema nos testes), ~40MB.
- `ffmpeg` + `ffprobe`: um único tarball estático do johnvansickle.com
  (~42MB comprimido), extraído uma vez — os dois binários saem da mesma
  extração, sem baixar duas vezes.

Implementado em `src/lib/vendored-binary.ts`. Testei de ponta a ponta,
com binário de verdade, sem mock:

```
yt-dlp: 2026.08.19 at /tmp/kronia-bin/yt-dlp
yt-dlp download+run: 1.896s
ffmpeg: ... at /tmp/kronia-bin/ffmpeg
ffmpeg download+run: 5.730s
ffprobe: ffprobe version 7.0.2-static ... at /tmp/kronia-bin/ffprobe
ffprobe (reutilizou a extração do ffmpeg): 7.778ms
yt-dlp segunda chamada (cacheada em memória): 0.007ms
```

E depois validei o pipeline de processamento completo (`probeVideo`,
`extractFrames`, `transcribeWithWhisper` — essa última com uma chamada
real à API da Groq, não mockada) rodando sobre um vídeo sintético de 6s
gerado localmente com o próprio ffmpeg (pra não depender de nenhuma URL
externa no teste) — os 3 passos rodaram e devolveram dado real.

`.output` do build voltou a 4.5MB (era >250MB na tentativa 3, e o build
não crashava mais).

**O que não foi testado**: baixar um vídeo de verdade de uma URL do
TikTok/YouTube via yt-dlp rodando dentro do Vercel em produção — só validei
o binário rodando (`--version`) e o mecanismo de download em si, que é o
uso normal e documentado do yt-dlp (não uma parte nova/arriscada do meu
código). Risco residual baixo comparado ao que já foi provado funcionando.

**Decisão**: campo "Vídeo de referência" reabilitado na UI
(`src/routes/index.tsx`), trava do servidor removida
(`src/server/pipeline.functions.ts`).

**Status**: ✅ corrigido e testado (exceto o download real de um vídeo de
plataforma em produção, não verificável a partir daqui).

---

## 3. Dívida técnica conhecida (menor, não bloqueante)

- **Cost-tracker** (`src/lib/cost-tracker.ts`) grava uso em
  `logs/usage.jsonl`, em disco local — não sobrevive a deploy serverless
  (filesystem efêmero no Vercel). Também estima o custo da OpenAI sempre
  com preço de `gpt-4o-mini`, mesmo quando o fallback chama `gpt-5`
  (mais caro) — estimativa de custo do fallback fica errada.
- Nenhum aviso na UI quando uma geração usa o fallback pago (Groq
  estourou cota) — decisão consciente de adiar.
- `.env.example` estava desatualizado (não mencionava as env vars novas
  do fallback) — já corrigido (commit `550e029`).

---

## Resumo

| # | Achado | Severidade | Status |
|---|---|---|---|
| 1 | Schema inválido pra OpenAI (Teólogo/Psicologia de Compra/Ingestão) | Crítico | ✅ Corrigido |
| 2 | Ingestão depende de binários não disponíveis no Vercel | Alto | ✅ Corrigido (download sob demanda) |
| 3 | Cost-tracker não sobrevive a serverless + preço errado no fallback | Baixo | ❌ Não corrigido |
